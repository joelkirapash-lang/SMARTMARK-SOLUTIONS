import os
import tempfile
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _db_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        return "sqlite:///" + os.path.join(BASE_DIR, "smartmark_solutions.db")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-change-me-before-production-use"
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or "dev-jwt-secret-key-change-me-before-production-use"
    SQLALCHEMY_DATABASE_URI = _db_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get("ACCESS_TOKEN_HOURS", 10)))
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")
    RATELIMIT_STORAGE_URI = "memory://"
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR") or os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 6 * 1024 * 1024
    RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "1") != "0"


class TestConfig(Config):
    TESTING = True
    UPLOAD_DIR = tempfile.mkdtemp()
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
