from collections import defaultdict
from datetime import date

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import (User, Exam, Mark, Subject, PerformanceBand, Grade, School, TeacherAssignment, Stream,
                        SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, STAFF_ROLES, AuditLog, utcnow)
from app.routes.exams import exam_sort_key
from app.utils.audit import serialize_logs
from app.utils.auth import require, scoped
from app.utils.helpers import avg, band_for, class_maps

bp = Blueprint("dashboard", __name__, url_prefix="/api")
STAFF_VIEW = (SCHOOL_ADMIN, TEACHER, EDUCATOR)


def pending_items(school_id, assignments, with_teacher=False):
    """Marks still to be entered for every open (unpublished) exam."""
    exams = Exam.query.filter_by(school_id=school_id, is_published=False).all()
    if not exams or not assignments:
        return []
    maps = class_maps(school_id)
    names = {}
    if with_teacher:
        names = {u.id: u.full_name() for u in User.query.filter(User.id.in_({a.teacher_id for a in assignments})).all()}
    today = utcnow().date()
    items = []
    for a in assignments:
        q = User.query.filter_by(school_id=school_id, role=STUDENT, grade_id=a.grade_id, is_archived=False)
        if a.stream_id:
            q = q.filter_by(stream_id=a.stream_id)
        ids = [r[0] for r in q.with_entities(User.id).all()]
        if not ids:
            continue
        for e in exams:
            filled = Mark.query.filter(Mark.school_id == school_id, Mark.exam_id == e.id, Mark.subject_id == a.subject_id,
                                       Mark.score.isnot(None), Mark.student_id.in_(ids)).count()
            if filled >= len(ids):
                continue
            left = (e.marks_deadline - today).days if e.marks_deadline else None
            items.append({"exam_id": e.id, "exam": e.name, "grade_id": a.grade_id, "stream_id": a.stream_id,
                          "subject_id": a.subject_id, "grade": maps["grades"].get(a.grade_id),
                          "stream": maps["streams"].get(a.stream_id), "subject": maps["subjects"].get(a.subject_id),
                          "expected": len(ids), "filled": filled, "deadline": e.marks_deadline.isoformat() if e.marks_deadline else None,
                          "days_left": left, "overdue": left is not None and left < 0,
                          "teacher": names.get(a.teacher_id) if with_teacher else None})
    items.sort(key=lambda i: (i["days_left"] is None, i["days_left"] if i["days_left"] is not None else 0))
    return items


@bp.get("/notifications")
@require(*STAFF_VIEW)
def notifications():
    if g.role == SCHOOL_ADMIN:
        ass = TeacherAssignment.query.filter_by(school_id=g.school_id).all()
        items = [i for i in pending_items(g.school_id, ass, with_teacher=True)
                 if i["overdue"] or (i["days_left"] is not None and i["days_left"] <= 3)]
    else:
        ass = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=g.current_user.id).all()
        items = pending_items(g.school_id, ass)
    return jsonify(items=items[:50], overdue=sum(1 for i in items if i["overdue"]), total=len(items))


@bp.get("/dashboard/summary")
@require(*STAFF_VIEW)
def summary():
    school = db.session.get(School, g.school_id)
    if g.role != SCHOOL_ADMIN:
        ass = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=g.current_user.id).all()
        pend = pending_items(g.school_id, ass)
        classes = {(a.grade_id, a.stream_id) for a in ass}
        logs = (scoped(AuditLog).filter_by(actor_user_id=g.current_user.id)
                .order_by(AuditLog.created_at.desc()).limit(8).all())
        return jsonify({"assignments": len(ass), "classes": len(classes), "pending": pend[:20],
                        "pending_total": len(pend), "overdue": sum(1 for p in pend if p["overdue"]),
                        "activity": serialize_logs(logs)})

    counts = {"students": scoped(User).filter_by(role=STUDENT, is_archived=False).count(),
              "teachers": scoped(User).filter_by(role=TEACHER).count(),
              "educators": scoped(User).filter_by(role=EDUCATOR).count(),
              "grades": scoped(Grade).filter_by(is_archived=False).count()}
    data = {"counts": counts, "school": school.to_dict()}
    exams = sorted(scoped(Exam).all(), key=exam_sort_key)
    with_marks = [e for e in exams if scoped(Mark).filter_by(exam_id=e.id).first()]
    exam = next((e for e in with_marks if e.id == request.args.get("exam_id")), with_marks[-1] if with_marks else None)
    if exam:
        prior = None
        idx = with_marks.index(exam)
        if idx > 0:
            prior = with_marks[idx - 1]
        subjects = {s.id: s.name for s in scoped(Subject).all()}
        bands = scoped(PerformanceBand).order_by(PerformanceBand.min_score).all()
        marks = scoped(Mark).filter_by(exam_id=exam.id).filter(Mark.score.isnot(None)).all()
        by_subject, by_student = defaultdict(list), defaultdict(list)
        for m in marks:
            by_subject[m.subject_id].append(m.pct)
            by_student[m.student_id].append(m.pct)
        data["exam"] = exam.to_dict()
        data["subject_averages"] = [{"subject": subjects.get(k), "average": avg(v)} for k, v in by_subject.items()]
        dist = defaultdict(int)
        for v in by_student.values():
            b = band_for(bands, avg(v))
            dist[b.code if b else "Unranked"] += 1
        data["distribution"] = [{"band": k, "count": n} for k, n in dist.items()]
        if prior:
            prior_by = defaultdict(list)
            for m in scoped(Mark).filter_by(exam_id=prior.id).filter(Mark.score.isnot(None)).all():
                prior_by[m.student_id].append(m.pct)
            names = {u.id: u.full_name() for u in scoped(User).filter(User.id.in_(list(by_student.keys()))).all()}
            diffs = [{"student": names.get(s), "change": round(avg(v) - avg(prior_by[s]), 1)}
                     for s, v in by_student.items() if s in prior_by]
            data["most_improved"] = sorted(diffs, key=lambda d: -d["change"])[:6]
            data["prior_exam"] = prior.name
    ass = TeacherAssignment.query.filter_by(school_id=g.school_id).all()
    pend = [i for i in pending_items(g.school_id, ass, with_teacher=True) if i["overdue"]]
    data["overdue"] = pend[:8]
    data["overdue_total"] = len(pend)
    logs = scoped(AuditLog).filter(~AuditLog.action.like("IMPERSONATION%")).order_by(AuditLog.created_at.desc()).limit(10).all()
    data["activity"] = serialize_logs(logs)
    return jsonify(data)
