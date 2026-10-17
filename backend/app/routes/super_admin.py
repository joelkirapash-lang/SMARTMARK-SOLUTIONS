from collections import defaultdict
from datetime import timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models import (School, User, AuditLog, SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, STAFF_ROLES,
                        SUPER_ADMIN, utcnow, iso)
from app.routes.auth import make_token
from app.utils.audit import log_action, serialize_logs
from app.utils.auth import require
from app.utils.helpers import body, parse_date
from app.utils.identity import slugify, generate_login_email
from app.utils.security import generate_temp_password, hash_password

bp = Blueprint("super_admin", __name__, url_prefix="/api/super")
SA = SUPER_ADMIN
PAYMENT = {"PAID", "INSTALLMENTS", "OVERDUE", "TRIAL"}


def _counts(school_ids):
    out = defaultdict(lambda: {"students": 0, "teachers": 0, "educators": 0, "admins": 0})
    if not school_ids:
        return out
    rows = (db.session.query(User.school_id, User.role, func.count(User.id))
            .filter(User.school_id.in_(school_ids), User.is_archived.is_(False))
            .group_by(User.school_id, User.role).all())
    key = {STUDENT: "students", TEACHER: "teachers", EDUCATOR: "educators", SCHOOL_ADMIN: "admins"}
    for sid, role, n in rows:
        out[sid][key[role]] = n
    return out


def _school_row(s, counts):
    d = s.to_dict(internal=True)
    c = counts[s.id]
    d["usage"] = {"students": c["students"], "staff": c["teachers"] + c["educators"],
                  "teachers": c["teachers"], "educators": c["educators"], "admins": c["admins"]}
    return d


@bp.get("/stats")
@require(SA)
def stats():
    schools = School.query.all()
    counts = _counts([s.id for s in schools])
    total = {"students": 0, "staff": 0}
    for c in counts.values():
        total["students"] += c["students"]
        total["staff"] += c["teachers"] + c["educators"]
    attention = [s for s in schools if s.payment_status in ("OVERDUE", "INSTALLMENTS") or not s.is_active]
    top = sorted(schools, key=lambda s: counts[s.id]["students"], reverse=True)[:8]
    recent = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(12).all()
    return jsonify({
        "schools": len(schools), "active": sum(1 for s in schools if s.is_active),
        "suspended": sum(1 for s in schools if not s.is_active),
        "overdue": sum(1 for s in schools if s.payment_status == "OVERDUE"),
        "students": total["students"], "staff": total["staff"],
        "admins": sum(c["admins"] for c in counts.values()),
        "all_schools": [{"id": s.id, "name": s.name, "created_at": iso(s.created_at), "is_active": s.is_active,
                         "payment_status": s.payment_status, "admins": counts[s.id]["admins"],
                         "students": counts[s.id]["students"], "staff": counts[s.id]["teachers"] + counts[s.id]["educators"]}
                        for s in sorted(schools, key=lambda x: x.created_at, reverse=True)],
        "attention": [_school_row(s, counts) for s in attention],
        "top_schools": [{"name": s.name, "students": counts[s.id]["students"],
                         "staff": counts[s.id]["teachers"] + counts[s.id]["educators"]} for s in top],
        "recent_activity": serialize_logs(recent, include_school=True),
    })


@bp.get("/schools")
@require(SA)
def list_schools():
    schools = School.query.order_by(School.created_at.desc()).all()
    counts = _counts([s.id for s in schools])
    return jsonify([_school_row(s, counts) for s in schools])


def _apply_plan(s, d):
    if "name" in d and (d["name"] or "").strip():
        s.name = d["name"].strip()
    if "plan_name" in d:
        s.plan_name = (d["plan_name"] or "").strip() or None
    if "payment_status" in d and d["payment_status"]:
        if d["payment_status"] not in PAYMENT:
            raise ValueError("Payment status is not valid.")
        s.payment_status = d["payment_status"]
    if "next_payment_due" in d:
        s.next_payment_due = parse_date(d["next_payment_due"])
    if "billing_note" in d:
        s.billing_note = d["billing_note"] or None
    for f in ("max_students", "max_staff"):
        if f in d:
            v = d[f]
            if v in (None, ""):
                setattr(s, f, None)
            else:
                v = int(v)
                if v < 0:
                    raise ValueError("Limits cannot be negative.")
                setattr(s, f, v)


@bp.post("/schools")
@require(SA)
def create_school():
    d = body()
    name = (d.get("school_name") or "").strip()
    first = (d.get("admin_first_name") or "").strip()
    if not name or not first:
        return jsonify(error="School name and the admin's first name are required."), 400
    base = slugify(d.get("slug") or name)
    slug, n = base, 1
    while School.query.filter_by(slug=slug).first():
        n += 1
        slug = f"{base}-{n}"
    school = School(slug=slug, name=name, payment_status="PAID")
    try:
        _apply_plan(school, {k: v for k, v in d.items() if k != "name"})
    except (ValueError, TypeError) as e:
        return jsonify(error=str(e)), 400
    db.session.add(school)
    db.session.flush()
    second = (d.get("admin_second_name") or "").strip()
    email = generate_login_email(slug, first, second, SCHOOL_ADMIN)
    pw = generate_temp_password()
    admin = User(school_id=school.id, role=SCHOOL_ADMIN, first_name=first, second_name=second,
                 phone_number=d.get("admin_phone"), personal_email=(d.get("admin_personal_email") or None),
                 smartmark_email=email, password_hash=hash_password(pw), must_change_password=True,
                 created_by_id=g.current_user.id)
    db.session.add(admin)
    log_action(school.id, g.current_user.id, "SCHOOL_CREATED", f"{name}")
    db.session.commit()
    return jsonify(school=_school_row(school, _counts([school.id])),
                   credentials={"name": admin.full_name(), "email": email, "password": pw, "role": SCHOOL_ADMIN}), 201


@bp.put("/schools/<sid>")
@require(SA)
def update_school(sid):
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="School not found."), 404
    try:
        _apply_plan(s, body())
    except (ValueError, TypeError) as e:
        return jsonify(error=str(e)), 400
    log_action(s.id, g.current_user.id, "SCHOOL_UPDATED", s.name)
    db.session.commit()
    return jsonify(_school_row(s, _counts([s.id])))


@bp.post("/schools/<sid>/suspend")
@require(SA)
def suspend(sid):
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="School not found."), 404
    reason = (body().get("reason") or "").strip() or "Access has been paused. Please contact SMARTMARK SOLUTIONS."
    s.is_active, s.suspended_reason, s.suspended_at = False, reason[:500], utcnow()
    log_action(s.id, g.current_user.id, "SCHOOL_SUSPENDED", f"{s.name}: {reason}")
    db.session.commit()
    return jsonify(_school_row(s, _counts([s.id])))


@bp.post("/schools/<sid>/resume")
@require(SA)
def resume(sid):
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="School not found."), 404
    s.is_active, s.suspended_reason, s.suspended_at = True, None, None
    log_action(s.id, g.current_user.id, "SCHOOL_RESUMED", s.name)
    db.session.commit()
    return jsonify(_school_row(s, _counts([s.id])))


@bp.get("/schools/<sid>/users")
@require(SA)
def school_users(sid):
    q = User.query.filter_by(school_id=sid)
    role = request.args.get("role")
    if role:
        q = q.filter_by(role=role)
    term = (request.args.get("q") or "").strip().lower()
    if term:
        like = f"%{term}%"
        q = q.filter(db.or_(db.func.lower(User.first_name).like(like), db.func.lower(User.second_name).like(like),
                            db.func.lower(User.smartmark_email).like(like),
                            db.func.lower(User.admission_number).like(like)))
    users = q.order_by(User.first_name).limit(300).all()
    return jsonify([u.to_dict(full=False) for u in users])


@bp.post("/users/<uid>/reset-password")
@require(SA)
def reset_password(uid):
    u = db.session.get(User, uid)
    if u is None or u.role == SA:
        return jsonify(error="User not found."), 404
    pw = generate_temp_password()
    u.password_hash, u.must_change_password = hash_password(pw), True
    log_action(u.school_id, g.current_user.id, "PASSWORD_RESET", u.full_name())
    db.session.commit()
    return jsonify(credentials={"name": u.full_name(), "email": u.smartmark_email, "password": pw, "role": u.role})


@bp.post("/impersonate/<uid>")
@require(SA)
def impersonate(uid):
    u = db.session.get(User, uid)
    if u is None or u.role == SA or u.school_id is None:
        return jsonify(error="User not found."), 404
    school = db.session.get(School, u.school_id)
    log_action(u.school_id, g.current_user.id, "IMPERSONATION_STARTED", f"{u.full_name()} ({u.role}) at {school.name}")
    db.session.commit()
    return jsonify(access_token=make_token(u, imp=g.current_user.id), user=u.to_dict(),
                   school=school.to_dict() if school else None)


@bp.get("/activity")
@require(SA)
def platform_activity():
    q = AuditLog.query
    if request.args.get("school_id"):
        q = q.filter_by(school_id=request.args["school_id"])
    logs = q.order_by(AuditLog.created_at.desc()).limit(300).all()
    return jsonify(serialize_logs(logs, include_school=True))


@bp.post("/schools/<sid>/admins")
@require(SA)
def add_admin(sid):
    """A school may have any number of admins. They all have identical access."""
    s = db.session.get(School, sid)
    if s is None:
        return jsonify(error="School not found."), 404
    d = body()
    first, second = (d.get("first_name") or "").strip(), (d.get("second_name") or "").strip()
    if not first:
        return jsonify(error="Enter the admin's first name."), 400
    email = generate_login_email(s.slug, first, second, SCHOOL_ADMIN)
    pw = generate_temp_password()
    admin = User(school_id=s.id, role=SCHOOL_ADMIN, first_name=first, second_name=second or None,
                 phone_number=(d.get("phone") or None), smartmark_email=email, password_hash=hash_password(pw),
                 must_change_password=True, created_by_id=g.current_user.id)
    db.session.add(admin)
    log_action(s.id, g.current_user.id, "ACCOUNT_CREATED", f"School admin account for {admin.full_name()}")
    db.session.commit()
    n = User.query.filter_by(school_id=s.id, role=SCHOOL_ADMIN).count()
    return jsonify(credentials={"name": admin.full_name(), "email": email, "password": pw, "role": SCHOOL_ADMIN}, admins=n), 201


@bp.post("/users/<uid>/status")
@require(SA)
def set_admin_status(uid):
    u = db.session.get(User, uid)
    if u is None or u.role != SCHOOL_ADMIN:
        return jsonify(error="Admin not found."), 404
    active = bool(body().get("active"))
    if not active:
        others = User.query.filter(User.school_id == u.school_id, User.role == SCHOOL_ADMIN,
                                   User.status == "ACTIVE", User.id != u.id).count()
        if others == 0:
            return jsonify(error="A school must keep at least one active admin."), 400
    u.status = "ACTIVE" if active else "DISABLED"
    log_action(u.school_id, g.current_user.id, "ACCOUNT_ENABLED" if active else "ACCOUNT_DISABLED", u.full_name())
    db.session.commit()
    return jsonify(u.to_dict(full=False))
