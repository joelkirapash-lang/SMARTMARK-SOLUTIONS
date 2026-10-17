"""Automatic teacher comments, graded the way Kenyan schools word them.
The tier comes from where a score sits on the school's own performance levels,
so the wording follows whichever scale (4 or 8 levels) the school uses."""
from app.utils.helpers import band_for

_CUTS = [(0.95, "excellent"), (0.80, "very_good"), (0.65, "good"), (0.50, "fair"), (0.25, "weak")]
_PCT_CUTS = [(80, "excellent"), (70, "very_good"), (60, "good"), (50, "fair"), (25, "weak")]

SUBJECT = {
    "excellent": "Excellent performance. Keep it up!",
    "very_good": "Very good work. Aim even higher.",
    "good": "Good performance. Keep working hard.",
    "fair": "A fair attempt. More effort is needed.",
    "weak": "Below expectation. Work harder and seek help.",
    "very_weak": "Needs urgent improvement. Extra support is required.",
}
HEAD = {
    "excellent": "An outstanding result by {n} at {p}%. Keep up the excellent work.",
    "very_good": "A very good performance by {n} at {p}%. Aim even higher.",
    "good": "A good effort by {n} at {p}%. Keep working hard.",
    "fair": "A fair attempt by {n} at {p}%. Extra attention to weaker areas is encouraged.",
    "weak": "{n} scored {p}%, which is below expectation. Greater effort and support are needed.",
    "very_weak": "{n} scored {p}%. Serious improvement is needed. Parents are encouraged to work closely with the school.",
}
CLASS = {
    "excellent": "{n} has performed excellently this term.{s} Keep it up!",
    "very_good": "{n} has done very well this term.{s} Keep aiming higher.",
    "good": "A good term for {n}.{s}{w}",
    "fair": "{n} has made a fair attempt.{s}{w}",
    "weak": "{n} needs to improve.{s}{w}",
    "very_weak": "{n} needs a lot of support.{w}",
}


def tier_for(bands, pct):
    if pct is None:
        return None
    if bands:
        ordered = sorted(bands, key=lambda b: b.min_score)
        b = band_for(ordered, pct)
        ratio = 0.0 if b is None else (ordered.index(b) / (len(ordered) - 1) if len(ordered) > 1 else 1.0)
        for cut, tier in _CUTS:
            if ratio >= cut - 1e-9:
                return tier
        return "very_weak"
    for cut, tier in _PCT_CUTS:
        if pct >= cut:
            return tier
    return "very_weak"


def subject_remark(tier):
    return SUBJECT.get(tier)


def head_remark(name, pct, tier):
    return HEAD[tier].format(n=name.upper(), p=f"{pct:g}") if tier and pct is not None else None


def class_remark(name, tier, best, weak):
    if not tier:
        return None
    s = f" Strongest in {best}." if best else ""
    w = f" Please give more attention to {weak}." if weak and weak != best else ""
    if tier == "very_weak" and not w:
        w = " Please give extra attention to all weak areas."
    return CLASS[tier].format(n=name.upper(), s=s, w=w)
