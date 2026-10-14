import io

from flask import Blueprint, g, jsonify, request, send_file
from openpyxl import Workbook

from app.extensions import db
from app.models import (Mark, Exam, Subject, User, Grade, Stream, PerformanceBand, TeacherAssignment,
                        SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, STAFF_ROLES)
from app.utils.audit import log_action
from app.utils.auth import require, scoped
from app.utils.helpers import body, band_for, avg, class_maps

bp = Blueprint("marks", __name__, url_prefix="/api")
ADMIN = SCHOOL_ADMIN
STAFF_VIEW = (SCHOOL_ADMIN, TEACHER, EDUCATOR)


def staff_scope(user, grade_id, subject_id):
    """None -> not allowed. True -> every stream. set -> only these stream ids."""
    rows = TeacherAssignment.query.filter_by(school_id=user.school_id, teacher_id=user.id,
                                             grade_id=grade_id, subject_id=subject_id).all()
    if not rows:
        return None
    if any(r.stream_id is None for r in rows):
        return True
    return {r.stream_id for r in rows}


def _context():
    """Validate exam/grade/subject/stream from the query or body against the tenant."""
    src = request.args if request.method == "GET" else body()
    exam = scoped(Exam).filter_by(id=src.get("exam_id")).first()
    grade = scoped(Grade).filter_by(id=src.get("grade_id")).first()
    subject = scoped(Subject).filter_by(id=src.get("subject_id")).first()
    if not (exam and grade and subject):
        return None, (jsonify(error="Choose an exam, grade and subject."), 400)
    stream = None
    if src.get("stream_id"):
        stream = scoped(Stream).filter_by(id=src["stream_id"], grade_id=grade.id).first()
        if stream is None:
            return None, (jsonify(error="That stream does not belong to the selected grade."), 400)
    scope = True if g.role == ADMIN else staff_scope(g.current_user, grade.id, subject.id)
    if scope is None:
        return None, (jsonify(error="You are not assigned to this grade and subject."), 403)
    if stream is not None and scope is not True and stream.id not in scope:
        return None, (jsonify(error="You are not assigned to this stream."), 403)
    return (exam, grade, subject, stream, scope), None


def _roster(grade, stream, scope):
    q = scoped(User).filter_by(role=STUDENT, grade_id=grade.id, is_archived=False)
    if stream is not None:
        q = q.filter_by(stream_id=stream.id)
    elif scope is not True:
        q = q.filter(User.stream_id.in_(list(scope)))
    return q.order_by(User.first_name, User.second_name).all()


@bp.get("/marks/grid")
@require(*STAFF_VIEW)
def get_grid():
    ctx, err = _context()
    if err:
        return err
    exam, grade, subject, stream, scope = ctx
    students = _roster(grade, stream, scope)
    existing = {m.student_id: m for m in scoped(Mark).filter_by(exam_id=exam.id, subject_id=subject.id).all()}
    maps = class_maps(g.school_id)
    rows = []
    for s in students:
        m = existing.get(s.id)
        rows.append({"student_id": s.id, "student_name": s.full_name(), "admission_number": s.admission_number,
                     "stream_name": maps["streams"].get(s.stream_id),
                     "score": m.score if m else None, "max_score": (m.max_score if m else 100) or 100,
                     "remark": m.remark if m else None})
    locked = exam.is_published and g.role != ADMIN
    return jsonify(rows=rows, locked=locked, exam_published=exam.is_published)


@bp.post("/marks/grid")
@require(*STAFF_VIEW)
def save_grid():
    ctx, err = _context()
    if err:
        return err
    exam, grade, subject, stream, scope = ctx
    if exam.is_published and g.role != ADMIN:
        return jsonify(error="This exam is published, so marks are locked. Ask your administrator to make changes."), 403
    allowed = {s.id: s for s in _roster(grade, stream, scope)}
    saved, errors = 0, []
    existing = {m.student_id: m for m in scoped(Mark).filter_by(exam_id=exam.id, subject_id=subject.id).all()}
    for row in body().get("rows") or []:
        sid = row.get("student_id")
        s = allowed.get(sid)
        if s is None:
            errors.append({"student_id": sid, "error": "This learner is not in the selected class."})
            continue
        try:
            max_score = float(row.get("max_score") or 100)
            if max_score <= 0:
                raise ValueError
        except (TypeError, ValueError):
            errors.append({"student_id": sid, "error": "Out-of mark must be above 0."})
            continue
        raw = row.get("score")
        score = None
        if raw not in (None, ""):
            try:
                score = float(raw)
            except (TypeError, ValueError):
                errors.append({"student_id": sid, "error": f"{s.first_name}: score must be a number."})
                continue
            if score < 0 or score > max_score:
                errors.append({"student_id": sid, "error": f"{s.first_name}: score must be between 0 and {max_score:g}."})
                continue
        m = existing.get(sid)
        if m is None:
            m = Mark(school_id=g.school_id, exam_id=exam.id, student_id=sid, subject_id=subject.id,
                     grade_id=grade.id)
            db.session.add(m)
            existing[sid] = m
        m.stream_id, m.score, m.max_score = s.stream_id, score, max_score
        m.remark = (row.get("remark") or "").strip()[:500] or None
        m.entered_by_user_id = g.current_user.id
        saved += 1
    if saved:
        log_action(g.school_id, g.current_user.id, "MARKS_SAVED",
                   f"{subject.name} · {grade.name}{(' ' + stream.name) if stream else ''} · {exam.name} ({saved} learners)")
    db.session.commit()
    return jsonify(saved=saved, errors=errors)


def build_marklist(exam, grade, stream):
    marks = scoped(Mark).filter_by(exam_id=exam.id, grade_id=grade.id)
    if stream is not None:
        marks = marks.filter_by(stream_id=stream.id)
    marks = marks.all()
    roster = scoped(User).filter_by(role=STUDENT, grade_id=grade.id, is_archived=False)
    if stream is not None:
        roster = roster.filter_by(stream_id=stream.id)
    ids = {m.student_id for m in marks} | {s.id for s in roster.all()}
    students = User.query.filter(User.id.in_(ids)).all() if ids else []
    by_student = {}
    for m in marks:
        by_student.setdefault(m.student_id, {})[m.subject_id] = m
    subj_ids = {m.subject_id for m in marks}
    subjects = sorted(scoped(Subject).filter(Subject.id.in_(subj_ids)).all(), key=lambda s: s.name) if subj_ids else []
    bands = scoped(PerformanceBand).order_by(PerformanceBand.min_score).all()
    streams = {s.id: s.name for s in scoped(Stream).all()}
    rows = []
    for s in students:
        ms = by_student.get(s.id, {})
        pcts = [m.pct for m in ms.values() if m.pct is not None]
        average = avg(pcts)
        b = band_for(bands, average)
        rows.append({"student_id": s.id, "student_name": s.full_name(), "admission_number": s.admission_number,
                     "stream_name": streams.get(s.stream_id),
                     "scores": {sid: m.score for sid, m in ms.items()},
                     "total": round(sum(m.score for m in ms.values() if m.score is not None), 1),
                     "average": average, "band": b.code if b else None})
    rows.sort(key=lambda r: (r["average"] is None, -(r["average"] or 0), r["student_name"]))
    pos, prev = 0, None
    for i, r in enumerate(rows, start=1):
        if r["average"] is None:
            r["position"] = None
            continue
        if r["average"] != prev:
            pos, prev = i, r["average"]
        r["position"] = pos
    return {"subjects": [{"id": s.id, "name": s.name, "code": s.code} for s in subjects], "rows": rows}


def _ml_context():
    exam = scoped(Exam).filter_by(id=request.args.get("exam_id")).first()
    grade = scoped(Grade).filter_by(id=request.args.get("grade_id")).first()
    if not (exam and grade):
        return None, (jsonify(error="Choose an exam and a grade."), 400)
    stream = None
    if request.args.get("stream_id"):
        stream = scoped(Stream).filter_by(id=request.args["stream_id"], grade_id=grade.id).first()
        if stream is None:
            return None, (jsonify(error="That stream does not belong to the selected grade."), 400)
    return (exam, grade, stream), None


@bp.get("/marklist")
@require(*STAFF_VIEW)
def marklist():
    ctx, err = _ml_context()
    if err:
        return err
    return jsonify(build_marklist(*ctx))


@bp.get("/marklist/export")
@require(*STAFF_VIEW)
def marklist_export():
    ctx, err = _ml_context()
    if err:
        return err
    exam, grade, stream = ctx
    data = build_marklist(exam, grade, stream)
    wb = Workbook()
    ws = wb.active
    ws.title = "Marklist"
    ws.append([f"{grade.name}{(' ' + stream.name) if stream else ''} - {exam.name}"])
    ws.append(["Position", "Adm No", "Name", "Stream"] + [s["name"] for s in data["subjects"]] + ["Total", "Average %", "Level"])
    for r in data["rows"]:
        ws.append([r["position"], r["admission_number"], r["student_name"], r["stream_name"]]
                  + [r["scores"].get(s["id"]) for s in data["subjects"]] + [r["total"], r["average"], r["band"]])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name="marklist.xlsx",
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
