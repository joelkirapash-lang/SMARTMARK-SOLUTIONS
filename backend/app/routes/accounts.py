import csv
import io

from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import (User, Grade, Stream, School, SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT, STAFF_ROLES)
from app.utils.audit import log_action
from app.utils.auth import require, scoped
from app.utils.helpers import body, parse_date, class_maps, user_dict
from app.utils.identity import generate_login_email
from app.utils.security import generate_temp_password, hash_password

bp = Blueprint("accounts", __name__, url_prefix="/api")
ADMIN = SCHOOL_ADMIN
CREATABLE = (STUDENT, TEACHER, EDUCATOR)


def _usage(school):
    students = User.query.filter_by(school_id=school.id, role=STUDENT, is_archived=False).count()
    staff = User.query.filter(User.school_id == school.id, User.role.in_(STAFF_ROLES)).count()
    return {"students": {"used": students, "max": school.max_students},
            "staff": {"used": staff, "max": school.max_staff}}


def _check_limit(school, role, used):
    kind = "students" if role == STUDENT else "staff"
    mx = school.max_students if role == STUDENT else school.max_staff
    if mx is not None and used[kind] >= mx:
        raise ValueError(f"Your plan allows up to {mx} {kind}. Contact SMARTMARK SOLUTIONS to raise the limit.")


def _find(model, school_id, ref, **extra):
    if not ref:
        return None
    ref = str(ref).strip()
    q = model.query.filter_by(school_id=school_id, **extra)
    hit = q.filter_by(id=ref).first()
    if hit:
        return hit
    return q.filter(db.func.lower(model.name) == ref.lower()).first()


def _resolve_class(school_id, grade_ref, stream_ref):
    grade = stream = None
    if grade_ref:
        grade = _find(Grade, school_id, grade_ref, is_archived=False)
        if grade is None:
            raise ValueError(f"Grade '{grade_ref}' does not exist. Add it under Academics first.")
    if stream_ref:
        if grade is None:
            raise ValueError("Choose a grade before choosing a stream.")
        stream = _find(Stream, school_id, stream_ref, grade_id=grade.id)
        if stream is None:
            raise ValueError(f"Stream '{stream_ref}' does not exist in {grade.name}.")
    return grade, stream


def _apply_fields(u, school, d):
    """Copy editable profile fields onto a user, validating role specific ones."""
    for f in ("first_name", "second_name", "other_name", "gender", "personal_email", "phone_number"):
        if f in d:
            val = (d[f] or "").strip() if isinstance(d[f], str) else d[f]
            setattr(u, f, val or None)
    if not (u.first_name or "").strip():
        raise ValueError("First name is required.")
    if u.role == STUDENT:
        if "admission_number" in d:
            adm = (d["admission_number"] or "").strip()
            if not adm:
                raise ValueError("Admission number is required.")
            clash = User.query.filter(User.school_id == school.id, User.admission_number == adm, User.id != u.id).first()
            if clash:
                raise ValueError(f"Admission number {adm} is already used by {clash.full_name()}.")
            u.admission_number = adm
        if not u.admission_number:
            raise ValueError("Admission number is required.")
        if "grade_id" in d or "grade" in d or "stream_id" in d or "stream" in d:
            grade, stream = _resolve_class(school.id, d.get("grade_id") or d.get("grade"),
                                           d.get("stream_id") or d.get("stream"))
            if grade is None:
                raise ValueError("Grade is required.")
            u.grade_id, u.stream_id = grade.id, (stream.id if stream else None)
        if not u.grade_id:
            raise ValueError("Grade is required.")
        if "date_of_birth" in d:
            u.date_of_birth = parse_date(d["date_of_birth"])
        for f in ("guardian_name", "guardian_phone", "guardian_email"):
            if f in d:
                setattr(u, f, (d[f] or "").strip() or None)
    else:
        if "employee_id" in d:
            u.employee_id = (d["employee_id"] or "").strip() or None
        if any(k in d for k in ("home_grade_id", "home_grade", "home_stream_id", "home_stream")):
            grade, stream = _resolve_class(school.id, d.get("home_grade_id") or d.get("home_grade"),
                                           d.get("home_stream_id") or d.get("home_stream"))
            u.home_grade_id, u.home_stream_id = (grade.id if grade else None), (stream.id if stream else None)


def _create(school, creator, role, d, used, must_change=True):
    _check_limit(school, role, used)
    first, second = (d.get("first_name") or "").strip(), (d.get("second_name") or "").strip()
    if not first:
        raise ValueError("First name is required.")
    email = generate_login_email(school.slug, first, second, role)
    pw = generate_temp_password()
    u = User(school_id=school.id, role=role, first_name=first, second_name=second or None,
             smartmark_email=email, password_hash=hash_password(pw), must_change_password=must_change,
             created_by_id=creator.id)
    _apply_fields(u, school, d)
    db.session.add(u)
    db.session.flush()
    used["students" if role == STUDENT else "staff"] += 1
    return u, pw


def _creds(u, pw, maps):
    cls = None
    if u.role == STUDENT:
        cls = " ".join(x for x in [maps["grades"].get(u.grade_id), maps["streams"].get(u.stream_id)] if x)
    return {"id": u.id, "name": u.full_name(), "role": u.role, "email": u.smartmark_email,
            "password": pw, "class": cls, "admission_number": u.admission_number}


@bp.get("/accounts/usage")
@require(ADMIN)
def usage():
    return jsonify(_usage(db.session.get(School, g.school_id)))


@bp.get("/accounts")
@require(ADMIN)
def list_accounts():
    role = request.args.get("role")
    q = scoped(User).filter(User.role != SCHOOL_ADMIN)
    if role in CREATABLE:
        q = q.filter_by(role=role)
    if role == STUDENT or not role:
        q = q.filter(db.or_(User.role != STUDENT, User.is_archived.is_(False)))
    if request.args.get("grade_id"):
        q = q.filter_by(grade_id=request.args["grade_id"])
    if request.args.get("stream_id"):
        q = q.filter_by(stream_id=request.args["stream_id"])
    term = (request.args.get("q") or "").strip().lower()
    if term:
        like = f"%{term}%"
        q = q.filter(db.or_(db.func.lower(User.first_name).like(like), db.func.lower(User.second_name).like(like),
                            db.func.lower(User.admission_number).like(like),
                            db.func.lower(User.smartmark_email).like(like)))
    users = q.order_by(User.first_name, User.second_name).limit(1000).all()
    maps = class_maps(g.school_id)
    return jsonify([user_dict(u, maps) for u in users])


@bp.get("/students")
@require(ADMIN, TEACHER, EDUCATOR)
def list_students():
    """Read-only roster for staff. Guardian contacts and dates of birth are
    only visible to admins."""
    q = scoped(User).filter_by(role=STUDENT, is_archived=False)
    for key in ("grade_id", "stream_id"):
        if request.args.get(key):
            q = q.filter_by(**{key: request.args[key]})
    term = (request.args.get("q") or "").strip().lower()
    if term:
        like = f"%{term}%"
        q = q.filter(db.or_(db.func.lower(User.first_name).like(like), db.func.lower(User.second_name).like(like),
                            db.func.lower(User.admission_number).like(like)))
    maps = class_maps(g.school_id)
    full = g.role == ADMIN
    return jsonify([user_dict(u, maps, full=full) for u in q.order_by(User.first_name).limit(1000).all()])


@bp.post("/accounts")
@require(ADMIN)
def create_account():
    d = body()
    role = d.get("role")
    if role not in CREATABLE:
        return jsonify(error="Choose Student, Teacher or Educator."), 400
    school = db.session.get(School, g.school_id)
    try:
        u, pw = _create(school, g.current_user, role, d, _usage_flat(school), d.get("must_change_password", True))
    except ValueError as e:
        db.session.rollback()
        return jsonify(error=str(e)), 400
    log_action(g.school_id, g.current_user.id, "ACCOUNT_CREATED", f"{role.title()} account for {u.full_name()}",
               "user", u.id)
    db.session.commit()
    maps = class_maps(g.school_id)
    return jsonify(user=user_dict(u, maps), credentials=_creds(u, pw, maps)), 201


def _usage_flat(school):
    u = _usage(school)
    return {"students": u["students"]["used"], "staff": u["staff"]["used"]}


def _norm_key(k):
    return (k or "").strip().lower().replace(" ", "_").replace("-", "_")


@bp.post("/accounts/bulk")
@require(ADMIN)
def bulk_create():
    role = request.form.get("role", STUDENT)
    if role not in CREATABLE:
        return jsonify(error="Choose Student, Teacher or Educator."), 400
    f = request.files.get("file")
    if f is None:
        return jsonify(error="Attach a CSV file."), 400
    try:
        raw = f.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify(error="The file must be a UTF-8 CSV."), 400
    school = db.session.get(School, g.school_id)
    used = _usage_flat(school)
    maps = class_maps(g.school_id)
    created, errors = [], []
    for i, row in enumerate(csv.DictReader(io.StringIO(raw)), start=2):
        if i > 1001:
            errors.append({"row": i, "error": "Import is limited to 1000 rows at a time."})
            break
        d = {_norm_key(k): (v or "").strip() for k, v in row.items() if k}
        if not any(d.values()):
            continue
        try:
            with db.session.begin_nested():
                u, pw = _create(school, g.current_user, role, d, used)
            maps = class_maps(g.school_id)
            created.append(_creds(u, pw, maps))
        except ValueError as e:
            errors.append({"row": i, "error": str(e)})
    if created:
        log_action(g.school_id, g.current_user.id, "ACCOUNTS_BULK_CREATED", f"{len(created)} {role.lower()} accounts")
    db.session.commit()
    return jsonify(created=created, errors=errors), 201


@bp.put("/accounts/<uid>")
@require(ADMIN)
def update_account(uid):
    u = scoped(User).filter(User.id == uid, User.role.in_(CREATABLE)).first()
    if u is None:
        return jsonify(error="Account not found."), 404
    school = db.session.get(School, g.school_id)
    try:
        _apply_fields(u, school, body())
    except ValueError as e:
        db.session.rollback()
        return jsonify(error=str(e)), 400
    log_action(g.school_id, g.current_user.id, "ACCOUNT_UPDATED", u.full_name(), "user", u.id)
    db.session.commit()
    return jsonify(user_dict(u, class_maps(g.school_id)))


@bp.post("/accounts/<uid>/reset-password")
@require(ADMIN)
def reset_password(uid):
    u = scoped(User).filter(User.id == uid, User.role.in_(CREATABLE)).first()
    if u is None:
        return jsonify(error="Account not found."), 404
    pw = generate_temp_password()
    u.password_hash, u.must_change_password = hash_password(pw), True
    log_action(g.school_id, g.current_user.id, "PASSWORD_RESET", u.full_name(), "user", u.id)
    db.session.commit()
    return jsonify(credentials=_creds(u, pw, class_maps(g.school_id)))


@bp.post("/accounts/<uid>/status")
@require(ADMIN)
def set_status(uid):
    u = scoped(User).filter(User.id == uid, User.role.in_(CREATABLE)).first()
    if u is None:
        return jsonify(error="Account not found."), 404
    active = bool(body().get("active"))
    u.status = "ACTIVE" if active else "DISABLED"
    log_action(g.school_id, g.current_user.id, "ACCOUNT_ENABLED" if active else "ACCOUNT_DISABLED",
               u.full_name(), "user", u.id)
    db.session.commit()
    return jsonify(user_dict(u, class_maps(g.school_id)))
