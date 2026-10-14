from flask import Blueprint, g, jsonify

from app.extensions import db
from app.models import Exam, Mark, SCHOOL_ADMIN, STUDENT
from app.utils.audit import log_action
from app.utils.auth import require, scoped
from app.utils.helpers import body, parse_date

bp = Blueprint("exams", __name__, url_prefix="/api")
ADMIN = SCHOOL_ADMIN


def exam_sort_key(e):
    return (e.exam_date or e.created_at.date(), e.created_at)


@bp.get("/exams")
@require()
def list_exams():
    q = scoped(Exam)
    if g.role == STUDENT:
        q = q.filter_by(is_published=True)
    exams = sorted(q.all(), key=exam_sort_key, reverse=True)
    return jsonify([e.to_dict() for e in exams])


def _fill(e, d):
    if "name" in d:
        name = (d["name"] or "").strip()
        if not name:
            raise ValueError("Enter an exam name.")
        e.name = name
    if "term" in d:
        e.term = (d["term"] or "").strip() or None
    if "exam_date" in d:
        e.exam_date = parse_date(d["exam_date"])
    if "marks_deadline" in d:
        e.marks_deadline = parse_date(d["marks_deadline"])


@bp.post("/exams")
@require(ADMIN)
def create_exam():
    e = Exam(school_id=g.school_id, created_by_user_id=g.current_user.id, name="")
    try:
        _fill(e, body())
        if not e.name:
            raise ValueError("Enter an exam name.")
    except ValueError as err:
        return jsonify(error=str(err)), 400
    db.session.add(e)
    log_action(g.school_id, g.current_user.id, "EXAM_CREATED", e.name)
    db.session.commit()
    return jsonify(e.to_dict()), 201


@bp.put("/exams/<eid>")
@require(ADMIN)
def update_exam(eid):
    e = scoped(Exam).filter_by(id=eid).first()
    if e is None:
        return jsonify(error="Exam not found."), 404
    try:
        _fill(e, body())
    except ValueError as err:
        return jsonify(error=str(err)), 400
    log_action(g.school_id, g.current_user.id, "EXAM_UPDATED", e.name)
    db.session.commit()
    return jsonify(e.to_dict())


@bp.post("/exams/<eid>/publish")
@require(ADMIN)
def publish(eid):
    e = scoped(Exam).filter_by(id=eid).first()
    if e is None:
        return jsonify(error="Exam not found."), 404
    publish_it = body().get("published", True)
    e.is_published = bool(publish_it)
    log_action(g.school_id, g.current_user.id, "EXAM_PUBLISHED" if e.is_published else "EXAM_UNPUBLISHED", e.name)
    db.session.commit()
    return jsonify(e.to_dict())


@bp.delete("/exams/<eid>")
@require(ADMIN)
def delete_exam(eid):
    e = scoped(Exam).filter_by(id=eid).first()
    if e is None:
        return jsonify(error="Exam not found."), 404
    if scoped(Mark).filter_by(exam_id=eid).first():
        return jsonify(error="This exam has recorded marks and cannot be deleted."), 400
    db.session.delete(e)
    log_action(g.school_id, g.current_user.id, "EXAM_DELETED", e.name)
    db.session.commit()
    return jsonify(ok=True)
