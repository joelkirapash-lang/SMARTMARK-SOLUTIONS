import hashlib
import secrets

import bcrypt

_UP, _LOW, _DIG = "ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789"


def hash_password(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p, h):
    if not h:
        return False
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def generate_temp_password(length=10):
    """Cryptographically random, readable (no 0/O/1/l/I), never derived from user data."""
    chars = [secrets.choice(_UP), secrets.choice(_LOW), secrets.choice(_DIG)]
    pool = _UP + _LOW + _DIG
    chars += [secrets.choice(pool) for _ in range(length - 3)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def generate_secure_token():
    return secrets.token_urlsafe(32)


def hash_token(raw):
    return hashlib.sha256(raw.encode()).hexdigest()


def validate_password_strength(p):
    errs = []
    if not p or len(p) < 8:
        errs.append("Use at least 8 characters.")
    if not any(c.isupper() for c in p or ""):
        errs.append("Add an uppercase letter.")
    if not any(c.islower() for c in p or ""):
        errs.append("Add a lowercase letter.")
    if not any(c.isdigit() for c in p or ""):
        errs.append("Add a number.")
    return errs
