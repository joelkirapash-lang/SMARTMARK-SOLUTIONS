import os
import re
import uuid

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from app.extensions import db
from app.models import School, SCHOOL_ADMIN
from app.utils.audit import log_action
from app.utils.auth import require

bp = Blueprint("uploads", __name__, url_prefix="/api")
KINDS = {"crest": "crest_url", "signature": "head_signature_url", "stamp": "stamp_url"}
MAX_BYTES = 2 * 1024 * 1024
NAME_RE = re.compile(r"^[a-f0-9]{32}\.(png|jpg|gif|webp)$")
ID_RE = re.compile(r"^[a-f0-9-]{36}$")
MIME = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}


def _sniff(data):
    """Trust the file's bytes, never its name."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _dir(school_id):
    return os.path.join(current_app.config["UPLOAD_DIR"], school_id)


def _remove(school_id, url):
    if url and url.startswith(f"/api/files/{school_id}/"):
        name = url.rsplit("/", 1)[-1]
        if NAME_RE.match(name):
            try:
                os.remove(os.path.join(_dir(school_id), name))
            except OSError:
                pass


@bp.post("/school/upload")
@require(SCHOOL_ADMIN)
def upload():
    kind = request.form.get("kind")
    f = request.files.get("file")
    if kind not in KINDS or f is None:
        return jsonify(error="Choose what you are uploading and an image file."), 400
    data = f.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return jsonify(error="That image is larger than 2 MB. Please choose a smaller one."), 400
    ext = _sniff(data)
    if ext is None:
        return jsonify(error="Please choose a PNG, JPG, WebP or GIF image."), 400
    school = db.session.get(School, g.school_id)
    os.makedirs(_dir(school.id), exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(_dir(school.id), name), "wb") as out:
        out.write(data)
    field = KINDS[kind]
    _remove(school.id, getattr(school, field))
    setattr(school, field, f"/api/files/{school.id}/{name}")
    log_action(school.id, g.current_user.id, "SCHOOL_SETTINGS_UPDATED", f"{kind} image uploaded")
    db.session.commit()
    return jsonify(school.to_dict())


@bp.delete("/school/upload/<kind>")
@require(SCHOOL_ADMIN)
def remove(kind):
    if kind not in KINDS:
        return jsonify(error="Unknown image."), 400
    school = db.session.get(School, g.school_id)
    _remove(school.id, getattr(school, KINDS[kind]))
    setattr(school, KINDS[kind], None)
    log_action(school.id, g.current_user.id, "SCHOOL_SETTINGS_UPDATED", f"{kind} image removed")
    db.session.commit()
    return jsonify(school.to_dict())


@bp.get("/files/<school_id>/<name>")
def serve(school_id, name):
    """Crests, signatures and stamps appear on public parent report links, so these are public.
    File names are random and unguessable."""
    if not ID_RE.match(school_id) or not NAME_RE.match(name):
        return jsonify(error="Not found."), 404
    resp = send_from_directory(_dir(school_id), name, mimetype=MIME[name.rsplit(".", 1)[-1]], max_age=86400)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
