import re
import unicodedata

from app.models import User, SCHOOL_ADMIN, TEACHER, EDUCATOR, STUDENT

ROLE_SEGMENT = {SCHOOL_ADMIN: "admin", TEACHER: "teacher", EDUCATOR: "educator", STUDENT: "student"}


def normalize_part(v):
    if not v:
        return ""
    v = unicodedata.normalize("NFKD", v).encode("ascii", "ignore").decode("ascii").lower().strip()
    v = v.replace("'", "")
    v = re.sub(r"[\s_-]+", "", v)
    return re.sub(r"[^a-z0-9]", "", v)


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:60] or "school"


def generate_login_email(slug, first, second, role):
    """firstname.secondname@role.schoolslug.com - unique across the platform."""
    parts = [p for p in (normalize_part(first), normalize_part(second)) if p]
    base = ".".join(parts) or "user"
    domain = f"{ROLE_SEGMENT[role]}.{slug}.com"
    cand, n = f"{base}@{domain}", 1
    while User.query.filter_by(smartmark_email=cand).first() is not None:
        n += 1
        cand = f"{base}{n}@{domain}"
    return cand
