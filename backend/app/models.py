import uuid
from datetime import datetime, timezone

from app.extensions import db

SUPER_ADMIN = "SUPER_ADMIN"
SCHOOL_ADMIN = "SCHOOL_ADMIN"
TEACHER = "TEACHER"
EDUCATOR = "EDUCATOR"
STUDENT = "STUDENT"
STAFF_ROLES = (TEACHER, EDUCATOR)


def gen_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


def iso(v):
    """Always serialise datetimes as explicit UTC ('...Z') so browsers convert
    to the viewer's local time correctly. SQLite drops tzinfo, so naive values
    are treated as UTC."""
    if v is None:
        return None
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return v.isoformat()


class Stamp:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


def school_fk(nullable=False):
    return db.Column(db.String(36), db.ForeignKey("schools.id"), nullable=nullable, index=True)


class School(db.Model, Stamp):
    __tablename__ = "schools"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    motto = db.Column(db.String(255))
    crest_url = db.Column(db.String(500))
    address = db.Column(db.String(255))
    contact_email = db.Column(db.String(255))
    contact_phone = db.Column(db.String(50))
    current_term = db.Column(db.String(50))
    term_start = db.Column(db.Date)
    term_end = db.Column(db.Date)
    report_card_footer = db.Column(db.Text)
    # Platform / billing controls (managed by the Super Admin only)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    suspended_reason = db.Column(db.String(500))
    suspended_at = db.Column(db.DateTime(timezone=True))
    plan_name = db.Column(db.String(80))
    payment_status = db.Column(db.String(20), default="PAID")  # PAID | INSTALLMENTS | OVERDUE | TRIAL
    next_payment_due = db.Column(db.Date)
    max_students = db.Column(db.Integer)  # None = unlimited
    max_staff = db.Column(db.Integer)  # teachers + educators, None = unlimited
    billing_note = db.Column(db.Text)  # internal, never shown to the school

    def to_dict(self, internal=False):
        d = {
            "id": self.id, "slug": self.slug, "name": self.name, "motto": self.motto,
            "crest_url": self.crest_url, "address": self.address,
            "contact_email": self.contact_email, "contact_phone": self.contact_phone,
            "current_term": self.current_term, "term_start": iso(self.term_start),
            "term_end": iso(self.term_end), "report_card_footer": self.report_card_footer,
            "is_active": self.is_active, "suspended_reason": self.suspended_reason,
            "suspended_at": iso(self.suspended_at), "plan_name": self.plan_name,
            "payment_status": self.payment_status, "next_payment_due": iso(self.next_payment_due),
            "max_students": self.max_students, "max_staff": self.max_staff,
            "created_at": iso(self.created_at),
        }
        if internal:
            d["billing_note"] = self.billing_note
        return d


class Grade(db.Model, Stamp):
    __tablename__ = "grades"
    __table_args__ = (db.UniqueConstraint("school_id", "name", name="uq_grade_name"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    name = db.Column(db.String(50), nullable=False)
    order_index = db.Column(db.Integer, default=0)
    is_archived = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "order_index": self.order_index}


class Stream(db.Model, Stamp):
    __tablename__ = "streams"
    __table_args__ = (db.UniqueConstraint("grade_id", "name", name="uq_stream_name"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {"id": self.id, "grade_id": self.grade_id, "name": self.name}


class Subject(db.Model, Stamp):
    __tablename__ = "subjects"
    __table_args__ = (db.UniqueConstraint("school_id", "code", name="uq_subject_code"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "code": self.code}


class GradeSubject(db.Model, Stamp):
    __tablename__ = "grade_subjects"
    __table_args__ = (db.UniqueConstraint("grade_id", "subject_id", name="uq_grade_subject"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, index=True)
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"), nullable=False, index=True)


class PerformanceBand(db.Model, Stamp):
    __tablename__ = "performance_bands"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    code = db.Column(db.String(10), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    min_score = db.Column(db.Float, nullable=False)
    max_score = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "label": self.label,
                "min_score": self.min_score, "max_score": self.max_score}


class User(db.Model, Stamp):
    __tablename__ = "users"
    __table_args__ = (db.UniqueConstraint("school_id", "admission_number", name="uq_user_admission"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk(nullable=True)  # NULL only for SUPER_ADMIN
    role = db.Column(db.String(20), nullable=False, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    second_name = db.Column(db.String(100))
    other_name = db.Column(db.String(100))
    gender = db.Column(db.String(20))
    personal_email = db.Column(db.String(255))  # optional contact only
    phone_number = db.Column(db.String(50))
    smartmark_email = db.Column(db.String(255), nullable=False, unique=True, index=True)  # login identity
    password_hash = db.Column(db.String(255), nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    status = db.Column(db.String(20), default="ACTIVE", nullable=False)  # ACTIVE | DISABLED
    last_login_at = db.Column(db.DateTime(timezone=True))
    created_by_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    # staff
    employee_id = db.Column(db.String(50))
    home_grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"))
    home_stream_id = db.Column(db.String(36), db.ForeignKey("streams.id"))
    # student
    admission_number = db.Column(db.String(50), index=True)
    date_of_birth = db.Column(db.Date)
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"))
    stream_id = db.Column(db.String(36), db.ForeignKey("streams.id"))
    guardian_name = db.Column(db.String(200))
    guardian_phone = db.Column(db.String(50))
    guardian_email = db.Column(db.String(255))
    is_archived = db.Column(db.Boolean, default=False, nullable=False)

    def full_name(self):
        return " ".join(p for p in [self.first_name, self.second_name, self.other_name] if p)

    def to_dict(self, full=True):
        d = {
            "id": self.id, "school_id": self.school_id, "role": self.role,
            "first_name": self.first_name, "second_name": self.second_name,
            "other_name": self.other_name, "full_name": self.full_name(),
            "gender": self.gender, "smartmark_email": self.smartmark_email,
            "status": self.status, "must_change_password": self.must_change_password,
            "last_login_at": iso(self.last_login_at), "created_at": iso(self.created_at),
            "employee_id": self.employee_id, "home_grade_id": self.home_grade_id,
            "home_stream_id": self.home_stream_id, "admission_number": self.admission_number,
            "grade_id": self.grade_id, "stream_id": self.stream_id, "is_archived": self.is_archived,
        }
        if full:  # private details are only returned to admins / the user themselves
            d.update({
                "personal_email": self.personal_email, "phone_number": self.phone_number,
                "date_of_birth": iso(self.date_of_birth), "guardian_name": self.guardian_name,
                "guardian_phone": self.guardian_phone, "guardian_email": self.guardian_email,
            })
        return d


class TeacherAssignment(db.Model, Stamp):
    __tablename__ = "teacher_assignments"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    teacher_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False)
    stream_id = db.Column(db.String(36), db.ForeignKey("streams.id"))
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"), nullable=False)

    def to_dict(self):
        return {"id": self.id, "teacher_id": self.teacher_id, "grade_id": self.grade_id,
                "stream_id": self.stream_id, "subject_id": self.subject_id}


class Exam(db.Model, Stamp):
    __tablename__ = "exams"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    name = db.Column(db.String(150), nullable=False)
    term = db.Column(db.String(50))
    exam_date = db.Column(db.Date)
    marks_deadline = db.Column(db.Date)
    is_published = db.Column(db.Boolean, default=False, nullable=False)
    created_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))

    def to_dict(self):
        return {"id": self.id, "name": self.name, "term": self.term,
                "exam_date": iso(self.exam_date), "marks_deadline": iso(self.marks_deadline),
                "is_published": self.is_published, "created_at": iso(self.created_at)}


class Mark(db.Model, Stamp):
    __tablename__ = "marks"
    __table_args__ = (db.UniqueConstraint("exam_id", "student_id", "subject_id", name="uq_mark_unique"),)
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    exam_id = db.Column(db.String(36), db.ForeignKey("exams.id"), nullable=False, index=True)
    student_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"), nullable=False, index=True)
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, index=True)
    stream_id = db.Column(db.String(36), db.ForeignKey("streams.id"))
    score = db.Column(db.Float)
    max_score = db.Column(db.Float, default=100)
    remark = db.Column(db.String(500))
    entered_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))

    @property
    def pct(self):
        if self.score is None or not self.max_score:
            return None
        return self.score / self.max_score * 100


class RemarkTemplate(db.Model, Stamp):
    __tablename__ = "remark_templates"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"))  # None = any subject
    band_code = db.Column(db.String(10))
    text = db.Column(db.String(300), nullable=False)

    def to_dict(self):
        return {"id": self.id, "subject_id": self.subject_id, "band_code": self.band_code, "text": self.text}


class AuditLog(db.Model, Stamp):
    __tablename__ = "audit_logs"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk(nullable=True)
    actor_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    action = db.Column(db.String(100), nullable=False)
    detail = db.Column(db.String(500))
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.String(36))


class ReportShareLink(db.Model, Stamp):
    __tablename__ = "report_share_links"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    school_id = school_fk()
    student_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    exam_id = db.Column(db.String(36), db.ForeignKey("exams.id"), nullable=False)
    token_hash = db.Column(db.String(128), nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked = db.Column(db.Boolean, default=False)
