from datetime import timedelta

from flask import Blueprint, current_app, g, jsonify, request

from app.extensions import db, limiter
from app.models import (User, Exam, Mark, Subject, PerformanceBand, Grade, Stream, School, ReportShareLink,
                        SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, utcnow, iso)
from app.utils.audit import log_action
from app.utils.auth import require, scoped
from app.utils.helpers import body, band_for, avg
from app.utils.security import generate_secure_token, hash_token

bp = Blueprint("reports", __name__, url_prefix="/api")
STAFF_VIEW = (SCHOOL_ADMIN, TEACHER, EDUCATOR)


def build_card(school, student, exam):
    sid = school.id
    marks = Mark.query.filter_by(school_id=sid, exam_id=exam.id, student_id=student.id).all()
    subjects = {s.id: s.name for s in Subject.query.filter_by(school_id=sid)}
    bands = PerformanceBand.query.filter_by(school_id=sid).order_by(PerformanceBand.min_score).all()
    grade = db.session.get(Grade, marks[0].grade_id) if marks else db.session.get(Grade, student.grade_id)
    stream_id = marks[0].stream_id if marks else student.stream_id
    stream = db.session.get(Stream, stream_id) if stream_id else None

    rows, total, pcts = [], 0.0, []
    for m in sorted(marks, key=lambda x: subjects.get(x.subject_id, "")):
        b = band_for(bands, m.pct)
        rows.append({"subject": subjects.get(m.subject_id, "Subject"), "score": m.score, "max_score": m.max_score,
                     "pct": round(m.pct, 1) if m.pct is not None else None,
                     "band": b.code if b else None, "band_label": b.label if b else None, "remark": m.remark})
        if m.score is not None:
            total += m.score
            pcts.append(m.pct)
    average = avg(pcts)

    # class position among learners who sat the same exam in the same grade/stream
    position = size = None
    if marks:
        q = Mark.query.filter_by(school_id=sid, exam_id=exam.id, grade_id=marks[0].grade_id).filter(Mark.score.isnot(None))
        if stream_id:
            q = q.filter_by(stream_id=stream_id)
        per = {}
        for m in q.all():
            per.setdefault(m.student_id, []).append(m.pct)
        avgs = {k: avg(v) for k, v in per.items()}
        size = len(avgs)
        if student.id in avgs:
            position = 1 + sum(1 for v in avgs.values() if v > avgs[student.id])
    overall = band_for(bands, average)
    return {
        "school": {"name": school.name, "motto": school.motto, "crest_url": school.crest_url,
                   "address": school.address, "footer": school.report_card_footer, "term": school.current_term},
        "student": {"id": student.id, "name": student.full_name(), "admission_number": student.admission_number,
                    "grade": grade.name if grade else None, "stream": stream.name if stream else None},
        "exam": {"id": exam.id, "name": exam.name, "term": exam.term, "date": iso(exam.exam_date)},
        "subjects": rows, "total": round(total, 1), "average": average,
        "overall_band": overall.code if overall else None,
        "overall_label": overall.label if overall else None,
        "position": position, "class_size": size,
    }


@bp.get("/reports/card")
@require()
def card():
    student = scoped(User).filter_by(id=request.args.get("student_id"), role=STUDENT).first()
    exam = scoped(Exam).filter_by(id=request.args.get("exam_id")).first()
    if student is None or exam is None:
        return jsonify(error="Report card not found."), 404
    if g.role == STUDENT and (g.current_user.id != student.id or not exam.is_published):
        return jsonify(error="This report card is not available yet."), 403
    return jsonify(build_card(db.session.get(School, g.school_id), student, exam))


@bp.get("/reports/class")
@require(*STAFF_VIEW)
def class_cards():
    """All report cards for one class and exam, for printing in one go."""
    exam = scoped(Exam).filter_by(id=request.args.get("exam_id")).first()
    grade = scoped(Grade).filter_by(id=request.args.get("grade_id")).first()
    if exam is None or grade is None:
        return jsonify(error="Choose an exam and a grade."), 400
    ids = {m.student_id for m in scoped(Mark).filter_by(exam_id=exam.id, grade_id=grade.id).all()}
    q = scoped(User).filter(User.id.in_(ids)) if ids else None
    if request.args.get("stream_id") and q is not None:
        q = q.filter_by(stream_id=request.args["stream_id"])
    students = q.order_by(User.first_name).all() if q is not None else []
    school = db.session.get(School, g.school_id)
    return jsonify([build_card(school, s, exam) for s in students[:120]])


@bp.post("/reports/share-link")
@require(SCHOOL_ADMIN)
def share_link():
    d = body()
    student = scoped(User).filter_by(id=d.get("student_id"), role=STUDENT).first()
    exam = scoped(Exam).filter_by(id=d.get("exam_id")).first()
    if student is None or exam is None:
        return jsonify(error="Choose a learner and an exam."), 400
    if not exam.is_published:
        return jsonify(error="Publish the exam before sharing report cards with parents."), 400
    raw = generate_secure_token()
    link = ReportShareLink(school_id=g.school_id, student_id=student.id, exam_id=exam.id, token_hash=hash_token(raw),
                           expires_at=utcnow() + timedelta(days=30))
    db.session.add(link)
    log_action(g.school_id, g.current_user.id, "REPORT_LINK_CREATED", student.full_name())
    db.session.commit()
    base = current_app.config["FRONTEND_BASE_URL"].rstrip("/")
    return jsonify(url=f"{base}/report/{raw}", expires_at=iso(link.expires_at)), 201


@bp.get("/reports/shared/<raw>")
@limiter.limit("30 per minute")
def shared(raw):
    link = ReportShareLink.query.filter_by(token_hash=hash_token(raw), revoked=False).first()
    gone = jsonify(error="This link is invalid or has expired."), 404
    if link is None:
        return gone
    expires = link.expires_at if link.expires_at.tzinfo else link.expires_at.replace(tzinfo=utcnow().tzinfo)
    if expires < utcnow():
        return gone
    school, student, exam = (db.session.get(School, link.school_id), db.session.get(User, link.student_id),
                             db.session.get(Exam, link.exam_id))
    if not (school and student and exam and exam.is_published and school.is_active):
        return gone
    return jsonify(build_card(school, student, exam))
