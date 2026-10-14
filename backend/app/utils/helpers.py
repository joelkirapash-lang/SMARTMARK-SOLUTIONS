from datetime import datetime

from flask import request

from app.models import Grade, Stream, Subject


def body():
    return request.get_json(silent=True) or {}


def parse_date(v):
    if not v:
        return None
    if hasattr(v, "year"):
        return v
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(v).strip(), fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Date '{v}' is not valid. Use YYYY-MM-DD.")


def class_maps(school_id):
    grades = {g.id: g.name for g in Grade.query.filter_by(school_id=school_id)}
    streams = {s.id: s.name for s in Stream.query.filter_by(school_id=school_id)}
    subjects = {s.id: s.name for s in Subject.query.filter_by(school_id=school_id)}
    return {"grades": grades, "streams": streams, "subjects": subjects}


def user_dict(u, maps=None, full=True):
    d = u.to_dict(full=full)
    if maps:
        d["grade_name"] = maps["grades"].get(u.grade_id)
        d["stream_name"] = maps["streams"].get(u.stream_id)
        d["home_grade_name"] = maps["grades"].get(u.home_grade_id)
        d["home_stream_name"] = maps["streams"].get(u.home_stream_id)
    return d


def band_for(bands, pct):
    """bands sorted by min_score. Picks the highest band whose minimum is met,
    so fractional scores between bands (e.g. 79.5) are never left unranked."""
    if pct is None or not bands:
        return None
    chosen = None
    for b in bands:
        if pct >= b.min_score:
            chosen = b
    return chosen


def avg(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None
