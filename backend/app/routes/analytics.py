from collections import defaultdict

from flask import Blueprint, g, jsonify, request

from app.models import (Mark, Exam, Subject, Grade, Stream, User, TeacherAssignment, SCHOOL_ADMIN, TEACHER,
                        EDUCATOR, STUDENT)
from app.routes.exams import exam_sort_key
from app.utils.auth import require, scoped
from app.utils.helpers import avg

bp = Blueprint("analytics", __name__, url_prefix="/api")
STAFF_VIEW = (SCHOOL_ADMIN, TEACHER, EDUCATOR)
THRESH = 2.0  # percentage points that count as a real improvement / decline


def _status(latest, prev):
    if latest is None:
        return "none", None
    if prev is None:
        return "new", None
    change = round(latest - prev, 1)
    return ("improved" if change >= THRESH else "declined" if change <= -THRESH else "steady"), change


def _marks(mine):
    q = scoped(Mark).filter(Mark.score.isnot(None))
    for key in ("grade_id", "stream_id", "subject_id"):
        if request.args.get(key):
            q = q.filter(getattr(Mark, key) == request.args[key])
    marks = q.all()
    if mine and g.role != SCHOOL_ADMIN:
        ass = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=g.current_user.id).all()
        marks = [m for m in marks if any(a.grade_id == m.grade_id and a.subject_id == m.subject_id
                                         and (a.stream_id is None or a.stream_id == m.stream_id) for a in ass)]
    return marks


def _ordered_exams(exam_ids):
    exams = [e for e in scoped(Exam).all() if e.id in exam_ids]
    return sorted(exams, key=exam_sort_key)


@bp.get("/analytics/trends")
@require(*STAFF_VIEW)
def trends():
    marks = _marks(request.args.get("mine") == "1")
    exams = _ordered_exams({m.exam_id for m in marks})
    subjects = {s.id: s.name for s in scoped(Subject).all()}
    per = defaultdict(list)
    overall = defaultdict(list)
    for m in marks:
        per[(m.subject_id, m.exam_id)].append(m.pct)
        overall[m.exam_id].append(m.pct)
    sids = sorted({m.subject_id for m in marks}, key=lambda s: subjects.get(s, ""))
    series, summary = [], []
    for sid in sids:
        pts = [avg(per.get((sid, e.id), [])) for e in exams]
        series.append({"subject_id": sid, "subject": subjects.get(sid), "points": pts})
        vals = [p for p in pts if p is not None]
        latest = vals[-1] if vals else None
        prev = vals[-2] if len(vals) > 1 else None
        st, ch = _status(latest, prev)
        summary.append({"subject_id": sid, "subject": subjects.get(sid), "latest": latest, "previous": prev,
                        "change": ch, "status": st})
    o = [avg(overall.get(e.id, [])) for e in exams]
    ov = [p for p in o if p is not None]
    ost, och = _status(ov[-1] if ov else None, ov[-2] if len(ov) > 1 else None)
    return jsonify({"exams": [{"id": e.id, "name": e.name, "term": e.term} for e in exams], "series": series,
                    "overall": {"points": o, "latest": ov[-1] if ov else None, "change": och, "status": ost},
                    "summary": summary})


@bp.get("/analytics/overview")
@require(*STAFF_VIEW)
def overview():
    """Class x subject table: latest exam average vs the exam before it."""
    marks = _marks(request.args.get("mine") == "1")
    exam_map = {e.id: e for e in scoped(Exam).all()}
    grades = {x.id: x for x in scoped(Grade).all()}
    streams = {x.id: x.name for x in scoped(Stream).all()}
    subjects = {x.id: x.name for x in scoped(Subject).all()}
    groups = defaultdict(lambda: defaultdict(list))
    for m in marks:
        groups[(m.grade_id, m.stream_id, m.subject_id)][m.exam_id].append(m.pct)
    rows = []
    for (gid, stid, sid), by_exam in groups.items():
        ordered = sorted(by_exam.keys(), key=lambda eid: exam_sort_key(exam_map[eid]))
        latest = avg(by_exam[ordered[-1]])
        prev = avg(by_exam[ordered[-2]]) if len(ordered) > 1 else None
        st, ch = _status(latest, prev)
        grade = grades.get(gid)
        rows.append({"grade": grade.name if grade else None, "grade_order": grade.order_index if grade else 0,
                     "stream": streams.get(stid), "subject": subjects.get(sid), "latest": latest, "previous": prev,
                     "change": ch, "status": st, "exam": exam_map[ordered[-1]].name, "exams_count": len(ordered)})
    rows.sort(key=lambda r: (r["change"] is None, r["change"] if r["change"] is not None else 0))
    return jsonify(rows)


@bp.get("/me/progress")
@require(STUDENT)
def my_progress():
    me = g.current_user
    exams = sorted(scoped(Exam).filter_by(is_published=True).all(), key=exam_sort_key)
    subjects = {s.id: s.name for s in scoped(Subject).all()}
    own = defaultdict(list)
    for m in scoped(Mark).filter_by(student_id=me.id).all():
        own[m.exam_id].append(m)
    out = []
    for e in exams:
        mine = own.get(e.id, [])
        if not mine:
            continue
        class_marks = scoped(Mark).filter_by(exam_id=e.id, grade_id=mine[0].grade_id).filter(Mark.score.isnot(None)).all()
        class_by_subject = defaultdict(list)
        for m in class_marks:
            class_by_subject[m.subject_id].append(m.pct)
        out.append({"id": e.id, "name": e.name, "term": e.term,
                    "average": avg([m.pct for m in mine]), "class_average": avg([m.pct for m in class_marks]),
                    "subjects": [{"name": subjects.get(m.subject_id), "score": m.score, "max_score": m.max_score,
                                  "pct": round(m.pct, 1) if m.pct is not None else None,
                                  "class_pct": avg(class_by_subject.get(m.subject_id, []))}
                                 for m in sorted(mine, key=lambda x: subjects.get(x.subject_id, ""))]})
    return jsonify(exams=out)
