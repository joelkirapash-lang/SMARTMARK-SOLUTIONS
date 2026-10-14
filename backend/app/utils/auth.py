from functools import wraps

from flask import g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models import User, School, SUPER_ADMIN

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def require(*roles, relaxed=False):
    """Authenticate + authorise a route. The school always comes from the
    database record of the verified token's user - never from client input.
    `relaxed` skips the suspended-school / forced-password-change gates
    (used only by /auth/me and /auth/change-password)."""

    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            verify_jwt_in_request()
            claims = get_jwt()
            user = db.session.get(User, get_jwt_identity())
            if user is None or user.status != "ACTIVE":
                return jsonify(error="Your session is no longer valid. Please sign in again.", code="AUTH_REQUIRED"), 401
            imp = claims.get("imp")
            g.current_user, g.role, g.school_id, g.impersonating = user, user.role, user.school_id, bool(imp)
            if imp and request.method not in SAFE_METHODS:
                return jsonify(error="You are viewing this account in read-only mode.", code="VIEW_ONLY"), 403
            if user.role != SUPER_ADMIN and not imp and not relaxed:
                school = db.session.get(School, user.school_id)
                if school is None or not school.is_active:
                    return jsonify(error="Access for this school is paused.", code="SCHOOL_SUSPENDED",
                                   reason=school.suspended_reason if school else None), 403
                if user.must_change_password:
                    return jsonify(error="Set a new password to continue.", code="PASSWORD_CHANGE_REQUIRED"), 403
            if roles and user.role not in roles:
                return jsonify(error="You do not have permission to do this."), 403
            return fn(*a, **kw)

        return wrapper

    return deco


def scoped(model):
    """Every tenant query goes through here so school_id can never be skipped."""
    return model.query.filter_by(school_id=g.school_id)
