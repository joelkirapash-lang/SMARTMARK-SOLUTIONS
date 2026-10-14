from datetime import timedelta

from flask import Blueprint, g, jsonify
from flask_jwt_extended import create_access_token

from app.extensions import db, limiter
from app.models import User, School, utcnow, SUPER_ADMIN
from app.utils.audit import log_action
from app.utils.auth import require
from app.utils.helpers import body
from app.utils.security import verify_password, hash_password, validate_password_strength

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def make_token(user, imp=None):
    claims = {"role": user.role, "school_id": user.school_id}
    exp = None
    if imp:
        claims["imp"] = imp
        exp = timedelta(hours=2)
    return create_access_token(identity=user.id, additional_claims=claims, expires_delta=exp)


@bp.post("/login")
@limiter.limit("10 per minute")
def login():
    d = body()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    user = User.query.filter_by(smartmark_email=email).first()
    if user is None or not verify_password(password, user.password_hash):
        return jsonify(error="That email or password is not correct."), 401
    if user.status != "ACTIVE":
        return jsonify(error="This account has been disabled. Please contact your school administrator."), 403
    if user.role != SUPER_ADMIN:
        school = db.session.get(School, user.school_id)
        if school is None or not school.is_active:
            return jsonify(error="Access for this school is currently paused.", code="SCHOOL_SUSPENDED",
                           reason=school.suspended_reason if school else None), 403
    user.last_login_at = utcnow()
    log_action(user.school_id, user.id, "LOGIN_SUCCESS")
    db.session.commit()
    return jsonify(access_token=make_token(user), user=user.to_dict())


@bp.get("/me")
@require(relaxed=True)
def me():
    u = g.current_user
    school = db.session.get(School, u.school_id) if u.school_id else None
    out = {"user": u.to_dict(), "school": school.to_dict() if school else None, "impersonating": g.impersonating}
    return jsonify(out)


@bp.post("/change-password")
@require(relaxed=True)
def change_password():
    d = body()
    u = g.current_user
    if not verify_password(d.get("current_password") or "", u.password_hash):
        return jsonify(error="Your current password is not correct."), 400
    new = d.get("new_password") or ""
    errs = validate_password_strength(new)
    if errs:
        return jsonify(error="Choose a stronger password.", details=errs), 400
    if new == d.get("current_password"):
        return jsonify(error="Your new password must be different from the current one."), 400
    u.password_hash = hash_password(new)
    u.must_change_password = False
    log_action(u.school_id, u.id, "PASSWORD_CHANGED")
    db.session.commit()
    return jsonify(ok=True)
