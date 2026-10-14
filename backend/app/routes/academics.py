from flask import Blueprint, g, jsonify, request

from app.extensions import db
from app.models import (Grade, Stream, Subject, GradeSubject, PerformanceBand, TeacherAssignment, Mark, User,
                        SCHOOL_ADMIN, TEACHER, EDUCATOR, STAFF_ROLES)
from app.utils.audit import log_action
from app.utils.auth import require, scoped
from app.utils.helpers import body, class_maps

bp = Blueprint("academics", __name__, url_prefix="/api")
ADMIN = SCHOOL_ADMIN
ANY = (SCHOOL_ADMIN, TEACHER, EDUCATOR)

CBC_LEVELS = ["Playgroup", "PP1", "PP2"] + [f"Grade {i}" for i in range(1, 11)]
CBC_SUBJECTS = [("Mathematics", "MATH"), ("English", "ENG"), ("Kiswahili", "KIS"),
                ("Science and Technology", "SCI"), ("Social Studies", "SST"), ("Religious Education", "RE"),
                ("Creative Arts", "ART"), ("Agriculture and Nutrition", "AGR"),
                ("Pre-Technical Studies", "PTS"), ("Physical and Health Education", "PHE")]
CBC_BANDS = [("BE", "Below Expectation", 0, 39.99), ("AE", "Approaching Expectation", 40, 59.99),
             ("ME", "Meeting Expectation", 60, 79.99), ("EE", "Exceeding Expectation", 80, 100)]


@bp.get("/grades")
@require()
def list_grades():
    rows = scoped(Grade).filter_by(is_archived=False).order_by(Grade.order_index, Grade.name).all()
    return jsonify([r.to_dict() for r in rows])


@bp.post("/grades")
@require(ADMIN)
def create_grade():
    d = body()
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a grade name."), 400
    if scoped(Grade).filter(db.func.lower(Grade.name) == name.lower()).first():
        return jsonify(error=f"{name} already exists."), 400
    try:
        order = int(d.get("order_index") or 0)
    except (TypeError, ValueError):
        order = 0
    gr = Grade(school_id=g.school_id, name=name, order_index=order)
    db.session.add(gr)
    log_action(g.school_id, g.current_user.id, "GRADE_CREATED", name)
    db.session.commit()
    return jsonify(gr.to_dict()), 201


@bp.delete("/grades/<gid>")
@require(ADMIN)
def delete_grade(gid):
    gr = scoped(Grade).filter_by(id=gid).first()
    if gr is None:
        return jsonify(error="Grade not found."), 404
    if scoped(User).filter_by(grade_id=gid, is_archived=False).first():
        return jsonify(error="This grade still has students. Move or promote them first."), 400
    gr.is_archived = True
    log_action(g.school_id, g.current_user.id, "GRADE_DELETED", gr.name)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/streams")
@require()
def list_streams():
    q = scoped(Stream)
    if request.args.get("grade_id"):
        q = q.filter_by(grade_id=request.args["grade_id"])
    return jsonify([s.to_dict() for s in q.order_by(Stream.name).all()])


@bp.post("/streams")
@require(ADMIN)
def create_stream():
    d = body()
    name, gid = (d.get("name") or "").strip(), d.get("grade_id")
    if not name or not gid:
        return jsonify(error="Choose a grade and enter a stream name."), 400
    if scoped(Grade).filter_by(id=gid, is_archived=False).first() is None:
        return jsonify(error="Grade not found."), 400
    if scoped(Stream).filter(Stream.grade_id == gid, db.func.lower(Stream.name) == name.lower()).first():
        return jsonify(error=f"{name} already exists in that grade."), 400
    s = Stream(school_id=g.school_id, grade_id=gid, name=name)
    db.session.add(s)
    log_action(g.school_id, g.current_user.id, "STREAM_CREATED", name)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@bp.delete("/streams/<sid>")
@require(ADMIN)
def delete_stream(sid):
    s = scoped(Stream).filter_by(id=sid).first()
    if s is None:
        return jsonify(error="Stream not found."), 404
    if scoped(User).filter_by(stream_id=sid, is_archived=False).first():
        return jsonify(error="This stream still has students."), 400
    if scoped(Mark).filter_by(stream_id=sid).first():
        return jsonify(error="This stream has recorded marks and cannot be removed."), 400
    TeacherAssignment.query.filter_by(school_id=g.school_id, stream_id=sid).delete()
    db.session.delete(s)
    log_action(g.school_id, g.current_user.id, "STREAM_DELETED", s.name)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/subjects")
@require()
def list_subjects():
    return jsonify([s.to_dict() for s in scoped(Subject).order_by(Subject.name).all()])


@bp.post("/subjects")
@require(ADMIN)
def create_subject():
    d = body()
    name, code = (d.get("name") or "").strip(), (d.get("code") or "").strip().upper()
    if not name or not code:
        return jsonify(error="Enter a subject name and code."), 400
    if scoped(Subject).filter_by(code=code).first():
        return jsonify(error=f"Code {code} is already used."), 400
    s = Subject(school_id=g.school_id, name=name, code=code)
    db.session.add(s)
    log_action(g.school_id, g.current_user.id, "SUBJECT_CREATED", name)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@bp.delete("/subjects/<sid>")
@require(ADMIN)
def delete_subject(sid):
    s = scoped(Subject).filter_by(id=sid).first()
    if s is None:
        return jsonify(error="Subject not found."), 404
    if scoped(Mark).filter_by(subject_id=sid).first():
        return jsonify(error="This subject has recorded marks and cannot be removed."), 400
    TeacherAssignment.query.filter_by(school_id=g.school_id, subject_id=sid).delete()
    GradeSubject.query.filter_by(school_id=g.school_id, subject_id=sid).delete()
    db.session.delete(s)
    log_action(g.school_id, g.current_user.id, "SUBJECT_DELETED", s.name)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/grades/<gid>/subjects")
@require()
def grade_subjects(gid):
    rows = GradeSubject.query.filter_by(school_id=g.school_id, grade_id=gid).all()
    return jsonify([r.subject_id for r in rows])


@bp.put("/grades/<gid>/subjects")
@require(ADMIN)
def set_grade_subjects(gid):
    if scoped(Grade).filter_by(id=gid).first() is None:
        return jsonify(error="Grade not found."), 404
    ids = body().get("subject_ids") or []
    valid = {s.id for s in scoped(Subject).all()}
    GradeSubject.query.filter_by(school_id=g.school_id, grade_id=gid).delete()
    for sid in set(ids) & valid:
        db.session.add(GradeSubject(school_id=g.school_id, grade_id=gid, subject_id=sid))
    log_action(g.school_id, g.current_user.id, "GRADE_SUBJECTS_UPDATED")
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/performance-bands")
@require()
def list_bands():
    return jsonify([b.to_dict() for b in scoped(PerformanceBand).order_by(PerformanceBand.min_score).all()])


@bp.post("/performance-bands")
@require(ADMIN)
def create_band():
    d = body()
    try:
        code, label = (d["code"] or "").strip().upper(), (d["label"] or "").strip()
        lo, hi = float(d["min_score"]), float(d["max_score"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="Enter a code, label, and a minimum and maximum score."), 400
    if not code or not label or lo < 0 or hi < lo or hi > 100:
        return jsonify(error="Scores must be between 0 and 100, with the maximum above the minimum."), 400
    b = PerformanceBand(school_id=g.school_id, code=code, label=label, min_score=lo, max_score=hi)
    db.session.add(b)
    log_action(g.school_id, g.current_user.id, "BAND_CREATED", f"{code} {lo}-{hi}")
    db.session.commit()
    return jsonify(b.to_dict()), 201


@bp.delete("/performance-bands/<bid>")
@require(ADMIN)
def delete_band(bid):
    b = scoped(PerformanceBand).filter_by(id=bid).first()
    if b is None:
        return jsonify(error="Band not found."), 404
    db.session.delete(b)
    log_action(g.school_id, g.current_user.id, "BAND_DELETED", b.code)
    db.session.commit()
    return jsonify(ok=True)


# ---- optional one-click helpers. Nothing is created unless the admin asks. ----
@bp.post("/academics/cbc-levels")
@require(ADMIN)
def cbc_levels():
    have = {x.name.lower() for x in scoped(Grade).all()}
    added = 0
    for i, name in enumerate(CBC_LEVELS):
        if name.lower() not in have:
            db.session.add(Grade(school_id=g.school_id, name=name, order_index=i))
            added += 1
    log_action(g.school_id, g.current_user.id, "CBC_SETUP", f"{added} grades added")
    db.session.commit()
    return jsonify(added=added)


@bp.post("/academics/cbc-subjects")
@require(ADMIN)
def cbc_subjects():
    have = {x.code for x in scoped(Subject).all()}
    added = 0
    for name, code in CBC_SUBJECTS:
        if code not in have:
            db.session.add(Subject(school_id=g.school_id, name=name, code=code))
            added += 1
    log_action(g.school_id, g.current_user.id, "CBC_SETUP", f"{added} subjects added")
    db.session.commit()
    return jsonify(added=added)


@bp.post("/academics/cbc-bands")
@require(ADMIN)
def cbc_bands():
    if scoped(PerformanceBand).first():
        return jsonify(error="Bands already exist. Remove them first to load the starter set."), 400
    for code, label, lo, hi in CBC_BANDS:
        db.session.add(PerformanceBand(school_id=g.school_id, code=code, label=label, min_score=lo, max_score=hi))
    log_action(g.school_id, g.current_user.id, "CBC_SETUP", "performance bands loaded")
    db.session.commit()
    return jsonify(added=len(CBC_BANDS))


# ---- class access for teachers / educators ----
def _assignment_rows(rows, maps):
    return [{**a.to_dict(), "grade_name": maps["grades"].get(a.grade_id), "stream_name": maps["streams"].get(a.stream_id),
             "subject_name": maps["subjects"].get(a.subject_id)} for a in rows]


@bp.get("/staff/<tid>/assignments")
@require(ADMIN)
def get_assignments(tid):
    rows = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=tid).all()
    return jsonify(_assignment_rows(rows, class_maps(g.school_id)))


@bp.put("/staff/<tid>/assignments")
@require(ADMIN)
def set_assignments(tid):
    t = scoped(User).filter(User.id == tid, User.role.in_(STAFF_ROLES)).first()
    if t is None:
        return jsonify(error="Staff member not found."), 404
    maps = class_maps(g.school_id)
    clean, seen = [], set()
    for a in body().get("assignments") or []:
        gid, sid, stid = a.get("grade_id"), a.get("subject_id"), a.get("stream_id") or None
        if gid not in maps["grades"] or sid not in maps["subjects"] or (stid and stid not in maps["streams"]):
            return jsonify(error="One of the selected classes or subjects does not exist."), 400
        key = (gid, stid, sid)
        if key not in seen:
            seen.add(key)
            clean.append(key)
    TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=tid).delete()
    for gid, stid, sid in clean:
        db.session.add(TeacherAssignment(school_id=g.school_id, teacher_id=tid, grade_id=gid, stream_id=stid, subject_id=sid))
    log_action(g.school_id, g.current_user.id, "ASSIGNMENTS_UPDATED", t.full_name(), "user", t.id)
    db.session.commit()
    rows = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=tid).all()
    return jsonify(_assignment_rows(rows, maps))


@bp.get("/me/assignments")
@require(TEACHER, EDUCATOR)
def my_assignments():
    rows = TeacherAssignment.query.filter_by(school_id=g.school_id, teacher_id=g.current_user.id).all()
    return jsonify(_assignment_rows(rows, class_maps(g.school_id)))
