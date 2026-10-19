from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import (User, Grade, Stream, School, RemarkTemplate, AuditLog, Subject,
                        SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, iso)
from app.utils.audit import log_action, serialize_logs
from app.utils.auth import require, scoped
from app.utils.helpers import body, parse_date, user_dict, class_maps

bp = Blueprint("misc", __name__, url_prefix="/api")
ADMIN = SCHOOL_ADMIN
STAFF_VIEW = (SCHOOL_ADMIN, TEACHER, EDUCATOR)


@bp.get("/search")
@require(*STAFF_VIEW)
def search():
    term = (request.args.get("q") or "").strip().lower()
    if len(term) < 2:
        return jsonify(students=[], staff=[])
    like = f"%{term}%"
    name_match = db.or_(db.func.lower(User.first_name).like(like), db.func.lower(User.second_name).like(like),
                        db.func.lower(User.admission_number).like(like))
    maps = class_maps(g.school_id)
    students = scoped(User).filter(User.role == STUDENT, User.is_archived.is_(False), name_match).limit(8).all()
    staff = []
    if g.role == ADMIN:
        staff = scoped(User).filter(User.role.in_([TEACHER, EDUCATOR]), name_match).limit(6).all()
    return jsonify(students=[user_dict(u, maps, full=False) for u in students],
                   staff=[user_dict(u, maps, full=False) for u in staff])


@bp.get("/remarks")
@require(*STAFF_VIEW)
def list_remarks():
    q = scoped(RemarkTemplate)
    if request.args.get("subject_id"):
        q = q.filter(db.or_(RemarkTemplate.subject_id == request.args["subject_id"], RemarkTemplate.subject_id.is_(None)))
    return jsonify([r.to_dict() for r in q.order_by(RemarkTemplate.created_at.desc()).all()])


@bp.post("/remarks")
@require(ADMIN)
def create_remark():
    d = body()
    text = (d.get("text") or "").strip()
    if not text:
        return jsonify(error="Write the remark text."), 400
    sid = d.get("subject_id") or None
    if sid and scoped(Subject).filter_by(id=sid).first() is None:
        return jsonify(error="Subject not found."), 400
    r = RemarkTemplate(school_id=g.school_id, subject_id=sid, band_code=(d.get("band_code") or None), text=text[:300])
    db.session.add(r)
    log_action(g.school_id, g.current_user.id, "REMARK_CREATED", text[:80])
    db.session.commit()
    return jsonify(r.to_dict()), 201


@bp.delete("/remarks/<rid>")
@require(ADMIN)
def delete_remark(rid):
    r = scoped(RemarkTemplate).filter_by(id=rid).first()
    if r is None:
        return jsonify(error="Remark not found."), 404
    db.session.delete(r)
    log_action(g.school_id, g.current_user.id, "REMARK_DELETED")
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/activity")
@require(*STAFF_VIEW)
def activity():
    q = scoped(AuditLog).filter(~AuditLog.action.like("IMPERSONATION%"))
    if g.role != ADMIN:
        q = q.filter_by(actor_user_id=g.current_user.id)
    return jsonify(serialize_logs(q.order_by(AuditLog.created_at.desc()).limit(300).all()))


@bp.get("/school")
@require()
def get_school():
    return jsonify(db.session.get(School, g.school_id).to_dict())


@bp.put("/school")
@require(ADMIN)
def update_school():
    s = db.session.get(School, g.school_id)
    d = body()
    try:
        for f in ("name", "motto", "crest_url", "address", "contact_email", "contact_phone", "current_term",
                  "report_card_footer", "head_teacher_name", "head_signature_url", "stamp_url"):
            if f in d:
                v = (d[f] or "").strip() if isinstance(d[f], str) else d[f]
                if f == "name" and not v:
                    raise ValueError("The school name cannot be empty.")
                if f.endswith("_url") and v and not v.startswith(("http://", "https://", "/api/files/")):
                    raise ValueError("Use a web address that starts with https://, or upload an image.")
                setattr(s, f, v or None) if f != "name" else setattr(s, f, v)
        for f in ("term_start", "term_end", "next_term_begins"):
            if f in d:
                setattr(s, f, parse_date(d[f]))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    log_action(g.school_id, g.current_user.id, "SCHOOL_SETTINGS_UPDATED")
    db.session.commit()
    return jsonify(s.to_dict())


@bp.post("/promote")
@require(ADMIN)
def promote():
    """Year-end promotion. moves = [{from_grade_id, to_grade_id | null}].
    A null target graduates (archives) the learners. Streams carry over by name.
    Recorded marks keep their original grade, so history is never rewritten."""
    plan = []
    for m in body().get("moves") or []:
        src = scoped(Grade).filter_by(id=m.get("from_grade_id")).first()
        if src is None:
            return jsonify(error="A grade in the plan no longer exists."), 400
        dst = None
        if m.get("to_grade_id"):
            dst = scoped(Grade).filter_by(id=m["to_grade_id"]).first()
            if dst is None:
                return jsonify(error="A target grade no longer exists."), 400
        plan.append((src, dst, scoped(User).filter_by(role=STUDENT, grade_id=src.id, is_archived=False).all()))
    maps = class_maps(g.school_id)
    moved = graduated = 0
    for src, dst, students in plan:  # everything was read first, so nobody is promoted twice
        by_name = {s.name.lower(): s.id for s in scoped(Stream).filter_by(grade_id=dst.id)} if dst else {}
        for s in students:
            if dst is None:
                s.is_archived = True
                graduated += 1
            else:
                old = (maps["streams"].get(s.stream_id) or "").lower()
                s.grade_id, s.stream_id = dst.id, by_name.get(old)
                moved += 1
    log_action(g.school_id, g.current_user.id, "STUDENTS_PROMOTED", f"{moved} promoted, {graduated} graduated")
    db.session.commit()
    return jsonify(moved=moved, graduated=graduated)


@bp.get("/pulse")
@require(relaxed=True)
def pulse():
    """A tiny 'has anything changed?' check. Screens refresh only when this token changes, so
    the server is not asked for everything again every few seconds."""
    q = db.session.query(db.func.count(AuditLog.id), db.func.max(AuditLog.created_at))
    if g.school_id:
        q = q.filter(AuditLog.school_id == g.school_id)
    n, last = q.one()
    stamp = last.isoformat() if hasattr(last, "isoformat") else str(last or "")
    return jsonify(token=f"{n}:{stamp}")
