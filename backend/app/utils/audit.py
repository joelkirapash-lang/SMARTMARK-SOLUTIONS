from app.extensions import db
from app.models import AuditLog, User, School, iso

LABELS = {
    "LOGIN_SUCCESS": "Signed in", "PASSWORD_CHANGED": "Changed password", "PASSWORD_RESET": "Reset a password",
    "ACCOUNT_CREATED": "Created an account", "ACCOUNTS_BULK_CREATED": "Imported accounts",
    "ACCOUNT_UPDATED": "Updated an account", "ACCOUNT_DISABLED": "Disabled an account",
    "ACCOUNT_ENABLED": "Re-enabled an account", "MARKS_SAVED": "Saved marks",
    "EXAM_CREATED": "Created an exam", "EXAM_UPDATED": "Updated an exam", "EXAM_PUBLISHED": "Published an exam",
    "EXAM_UNPUBLISHED": "Unpublished an exam", "EXAM_DELETED": "Deleted an exam",
    "SCHOOL_CREATED": "School created", "SCHOOL_UPDATED": "School plan updated",
    "SCHOOL_SUSPENDED": "School paused", "SCHOOL_RESUMED": "School resumed",
    "SCHOOL_SETTINGS_UPDATED": "Updated school settings", "GRADE_CREATED": "Added a grade",
    "GRADE_DELETED": "Removed a grade", "STREAM_CREATED": "Added a stream", "STREAM_DELETED": "Removed a stream",
    "SUBJECT_CREATED": "Added a subject", "SUBJECT_DELETED": "Removed a subject",
    "BAND_CREATED": "Added a performance band", "BAND_DELETED": "Removed a performance band",
    "CBC_SETUP": "Loaded CBC starter data", "ASSIGNMENTS_UPDATED": "Updated class access",
    "STUDENTS_PROMOTED": "Promoted students", "REPORT_LINK_CREATED": "Created a parent link",
    "REMARK_CREATED": "Added a remark", "REMARK_DELETED": "Removed a remark",
    "IMPERSONATION_STARTED": "Viewed an account", "GRADE_SUBJECTS_UPDATED": "Updated subjects for a grade",
}
CATEGORY = {
    "LOGIN": "security", "PASSWORD": "security", "ACCOUNT": "accounts", "ACCOUNTS": "accounts",
    "STUDENTS": "accounts", "MARKS": "marks", "EXAM": "exams", "SCHOOL": "school", "GRADE": "academics",
    "STREAM": "academics", "SUBJECT": "academics", "BAND": "academics", "ASSIGNMENTS": "academics",
    "REMARK": "academics", "CBC": "academics", "IMPERSONATION": "platform", "REPORT": "reports",
}


def log_action(school_id, actor_id, action, detail=None, target_type=None, target_id=None):
    db.session.add(AuditLog(school_id=school_id, actor_user_id=actor_id, action=action,
                            detail=(detail[:500] if detail else None), target_type=target_type, target_id=target_id))


def serialize_logs(logs, include_school=False):
    actor_ids = {l.actor_user_id for l in logs if l.actor_user_id}
    actors = {u.id: u for u in User.query.filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
    schools = {}
    if include_school:
        sids = {l.school_id for l in logs if l.school_id}
        schools = {s.id: s.name for s in School.query.filter(School.id.in_(sids)).all()} if sids else {}
    out = []
    for l in logs:
        a = actors.get(l.actor_user_id)
        out.append({
            "id": l.id, "action": l.action,
            "label": LABELS.get(l.action, l.action.replace("_", " ").capitalize()),
            "category": CATEGORY.get(l.action.split("_")[0], "other"),
            "detail": l.detail, "actor_name": a.full_name() if a else "System",
            "actor_role": a.role if a else None, "school_name": schools.get(l.school_id),
            "created_at": iso(l.created_at),
        })
    return out
