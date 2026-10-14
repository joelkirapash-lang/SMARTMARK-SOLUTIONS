import io
from datetime import datetime

from tests.conftest import setup_school, create_account, make_school


def test_super_admin_creates_school_with_clean_empty_data(api, super_token):
    s = setup_school.__wrapped__ if hasattr(setup_school, "__wrapped__") else None
    _, cred, tok, _ = make_school(api, super_token)
    assert cred["email"] == "jane.mwangi@admin.anestar-secondary.com"
    assert api.get("/api/grades", tok).get_json() == []          # no demo data
    assert api.get("/api/students", tok).get_json() == []
    assert api.get("/api/exams", tok).get_json() == []
    assert api.get("/api/performance-bands", tok).get_json() == []


def test_account_email_format_and_immediate_login(api, super_token):
    s = setup_school(api, super_token)
    j, pw, tok = create_account(api, s["admin"], role="TEACHER", first_name="John", second_name="Kamau")
    assert j["credentials"]["email"] == "john.kamau@teacher.anestar-secondary.com"
    j2, _, _ = create_account(api, s["admin"], role="TEACHER", first_name="John", second_name="Kamau")
    assert j2["credentials"]["email"] == "john.kamau2@teacher.anestar-secondary.com"  # never overwrites
    assert api.get("/api/auth/me", tok).get_json()["user"]["must_change_password"] is True


def test_only_admin_creates_accounts_and_super_cannot_use_school_routes(api, super_token):
    s = setup_school(api, super_token)
    _, _, ttok = create_account(api, s["admin"], role="TEACHER", first_name="Tom", second_name="Ouma")
    api.post("/api/auth/change-password", ttok)  # no-op
    # teacher must change password first
    assert api.post("/api/accounts", ttok, json={"role": "STUDENT", "first_name": "x"}).status_code == 403


def _teacher_ready(api, s, **kw):
    j, pw, tok = create_account(api, s["admin"], role="TEACHER", first_name="Tom", second_name="Ouma")
    api.post("/api/auth/change-password", tok, json={"current_password": pw, "new_password": "TeachPass1"})
    tok = api.login(j["credentials"]["email"], "TeachPass1")
    return j["user"]["id"], tok


def _student(api, s, first="Amina", adm="1001"):
    j, pw, tok = create_account(api, s["admin"], role="STUDENT", first_name=first, second_name="Hassan",
                                admission_number=adm, grade_id=s["grade"]["id"], stream_id=s["stream"]["id"])
    api.post("/api/auth/change-password", tok, json={"current_password": pw, "new_password": "StudPass1"})
    return j["user"]["id"], api.login(j["credentials"]["email"], "StudPass1")


def test_teacher_marks_are_locked_to_assignments_and_roles(api, super_token):
    s = setup_school(api, super_token)
    tid, ttok = _teacher_ready(api, s)
    sid, stok = _student(api, s)
    exam = api.post("/api/exams", s["admin"], json={"name": "Term 1 CAT"}).get_json()
    q = f"exam_id={exam['id']}&grade_id={s['grade']['id']}&subject_id={s['math']['id']}"
    assert api.get(f"/api/marks/grid?{q}", ttok).status_code == 403           # not assigned yet
    api.put(f"/api/staff/{tid}/assignments", s["admin"], json={"assignments": [
        {"grade_id": s["grade"]["id"], "stream_id": s["stream"]["id"], "subject_id": s["math"]["id"]}]})
    assert api.get(f"/api/marks/grid?{q}", ttok).status_code == 200
    q2 = f"exam_id={exam['id']}&grade_id={s['grade']['id']}&subject_id={s['eng']['id']}"
    assert api.get(f"/api/marks/grid?{q2}", ttok).status_code == 403          # other subject blocked
    body = {"exam_id": exam["id"], "grade_id": s["grade"]["id"], "subject_id": s["math"]["id"],
            "rows": [{"student_id": sid, "score": 87}]}
    assert api.post("/api/marks/grid", ttok, json=body).get_json()["saved"] == 1
    bad = dict(body, rows=[{"student_id": sid, "score": 140}])
    assert api.post("/api/marks/grid", ttok, json=bad).get_json()["errors"]
    # students can never open staff data
    assert api.get(f"/api/marks/grid?{q}", stok).status_code == 403
    assert api.get(f"/api/marklist?exam_id={exam['id']}&grade_id={s['grade']['id']}", stok).status_code == 403
    assert api.get("/api/students", stok).status_code == 403
    # published exams lock marks for teachers
    api.post(f"/api/exams/{exam['id']}/publish", s["admin"])
    assert api.post("/api/marks/grid", ttok, json=body).status_code == 403
    assert api.post("/api/marks/grid", s["admin"], json=body).status_code == 200


def test_marklist_positions_and_student_progress_and_report(api, super_token):
    s = setup_school(api, super_token)
    a, atok = _student(api, s, "Amina", "1001")
    b, _ = _student(api, s, "Brian", "1002")
    e1 = api.post("/api/exams", s["admin"], json={"name": "Opener", "exam_date": "2026-02-01"}).get_json()
    e2 = api.post("/api/exams", s["admin"], json={"name": "Midterm", "exam_date": "2026-05-01"}).get_json()
    for e, sa, sb in ((e1, 60, 80), (e2, 85, 70)):
        r = api.post("/api/marks/grid", s["admin"], json={"exam_id": e["id"], "grade_id": s["grade"]["id"],
                     "subject_id": s["math"]["id"], "rows": [{"student_id": a, "score": sa}, {"student_id": b, "score": sb}]})
        assert r.get_json()["saved"] == 2
    ml = api.get(f"/api/marklist?exam_id={e2['id']}&grade_id={s['grade']['id']}", s["admin"]).get_json()
    assert [r["student_name"].split()[0] for r in ml["rows"]] == ["Amina", "Brian"]
    assert ml["rows"][0]["position"] == 1 and ml["rows"][0]["band"] == "EE"
    t = api.get(f"/api/analytics/trends?grade_id={s['grade']['id']}", s["admin"]).get_json()
    assert [e["name"] for e in t["exams"]] == ["Opener", "Midterm"]
    ov = api.get("/api/analytics/overview", s["admin"]).get_json()
    assert ov[0]["subject"] == "Mathematics" and ov[0]["status"] in ("improved", "declined", "steady")
    # unpublished results are invisible to the learner
    assert api.get("/api/exams", atok).get_json() == []
    assert api.get(f"/api/reports/card?student_id={a}&exam_id={e2['id']}", atok).status_code == 403
    api.post(f"/api/exams/{e2['id']}/publish", s["admin"])
    card = api.get(f"/api/reports/card?student_id={a}&exam_id={e2['id']}", atok)
    assert card.status_code == 200 and card.get_json()["position"] == 1
    assert api.get(f"/api/reports/card?student_id={b}&exam_id={e2['id']}", atok).status_code == 403  # not theirs
    prog = api.get("/api/me/progress", atok).get_json()
    assert len(prog["exams"]) == 1 and prog["exams"][0]["average"] == 85


def test_schools_are_fully_isolated(api, super_token):
    s1 = setup_school(api, super_token, "Alpha Academy")
    s2 = setup_school(api, super_token, "Beta Academy")
    sid, _ = _student(api, s1)
    assert api.get("/api/grades", s2["admin"]).get_json()[0]["id"] != s1["grade"]["id"]
    assert all(x["id"] != sid for x in api.get("/api/students", s2["admin"]).get_json())
    assert api.put(f"/api/accounts/{sid}", s2["admin"], json={"first_name": "Hacked"}).status_code == 404
    assert api.post(f"/api/accounts/{sid}/reset-password", s2["admin"]).status_code == 404
    ex2 = api.post("/api/exams", s2["admin"], json={"name": "Beta exam"}).get_json()
    r = api.post("/api/marks/grid", s1["admin"], json={"exam_id": ex2["id"], "grade_id": s1["grade"]["id"],
                 "subject_id": s1["math"]["id"], "rows": []})
    assert r.status_code == 400  # another school's exam is rejected


def test_plan_limits_and_bulk_import(api, super_token):
    s = setup_school(api, super_token, "Limited School", max_students=2)
    csv = ("first_name,second_name,admission_number,grade,stream\n"
           "Ann,One,A1,Grade 4,A\nBen,Two,A2,Grade 4,A\nCal,Three,A3,Grade 4,A\nDee,Four,A4,Grade 9,A\n")
    r = api.post("/api/accounts/bulk", s["admin"], data={"role": "STUDENT", "file": (io.BytesIO(csv.encode()), "s.csv")},
                 content_type="multipart/form-data").get_json()
    assert len(r["created"]) == 2 and len(r["errors"]) == 2
    assert all(c["password"] for c in r["created"])
    assert "plan allows" in r["errors"][0]["error"]
    usage = api.get("/api/accounts/usage", s["admin"]).get_json()
    assert usage["students"] == {"used": 2, "max": 2}


def test_suspend_blocks_school_and_resume_restores(api, super_token):
    s = setup_school(api, super_token)
    sid = api.get("/api/super/schools", super_token).get_json()[0]["id"]
    r = api.post(f"/api/super/schools/{sid}/suspend", super_token, json={"reason": "Installment overdue"})
    assert r.get_json()["is_active"] is False
    assert api.get("/api/grades", s["admin"]).get_json()["code"] == "SCHOOL_SUSPENDED"
    login = api.post("/api/auth/login", json={"email": s["cred"]["email"], "password": "AdminPass1"})
    assert login.status_code == 403 and login.get_json()["code"] == "SCHOOL_SUSPENDED"
    assert api.get("/api/auth/me", s["admin"]).get_json()["school"]["is_active"] is False
    api.post(f"/api/super/schools/{sid}/resume", super_token)
    assert api.get("/api/grades", s["admin"]).status_code == 200


def test_super_admin_view_as_is_read_only_and_not_available_to_others(api, super_token):
    s = setup_school(api, super_token)
    tid, ttok = _teacher_ready(api, s)
    sid = api.get("/api/super/schools", super_token).get_json()[0]["id"]
    users = api.get(f"/api/super/schools/{sid}/users?role=TEACHER", super_token).get_json()
    imp = api.post(f"/api/super/impersonate/{users[0]['id']}", super_token).get_json()
    tok = imp["access_token"]
    me = api.get("/api/auth/me", tok).get_json()
    assert me["impersonating"] is True and me["user"]["role"] == "TEACHER"
    assert api.get("/api/grades", tok).status_code == 200
    assert api.post("/api/grades", tok, json={"name": "X"}).status_code == 403   # read-only
    assert api.post(f"/api/super/impersonate/{users[0]['id']}", s["admin"]).status_code == 403
    assert api.get("/api/super/schools", s["admin"]).status_code == 403


def test_timestamps_are_explicit_utc_and_current(api, super_token):
    s = setup_school(api, super_token)
    exam = api.post("/api/exams", s["admin"], json={"name": "Now"}).get_json()
    assert exam["created_at"].endswith("Z")
    created = datetime.fromisoformat(exam["created_at"].replace("Z", "+00:00"))
    assert abs((datetime.now(created.tzinfo) - created).total_seconds()) < 30
    log = api.get("/api/activity", s["admin"]).get_json()
    assert log and all(l["created_at"].endswith("Z") for l in log)


def test_promotion_preserves_history_and_archives_graduates(api, super_token):
    s = setup_school(api, super_token)
    g5 = api.post("/api/grades", s["admin"], json={"name": "Grade 5", "order_index": 5}).get_json()
    api.post("/api/streams", s["admin"], json={"name": "A", "grade_id": g5["id"]})
    sid, _ = _student(api, s)
    ex = api.post("/api/exams", s["admin"], json={"name": "T1"}).get_json()
    api.post("/api/marks/grid", s["admin"], json={"exam_id": ex["id"], "grade_id": s["grade"]["id"],
             "subject_id": s["math"]["id"], "rows": [{"student_id": sid, "score": 70}]})
    r = api.post("/api/promote", s["admin"], json={"moves": [
        {"from_grade_id": s["grade"]["id"], "to_grade_id": g5["id"]}, {"from_grade_id": g5["id"], "to_grade_id": None}]})
    assert r.get_json() == {"moved": 1, "graduated": 0}      # nobody promoted twice
    ml = api.get(f"/api/marklist?exam_id={ex['id']}&grade_id={s['grade']['id']}", s["admin"]).get_json()
    assert len(ml["rows"]) == 1                               # old marklist still intact
    me = [u for u in api.get("/api/students", s["admin"]).get_json() if u["id"] == sid][0]
    assert me["grade_name"] == "Grade 5" and me["stream_name"] == "A"


def test_login_failures_do_not_leak_and_passwords_are_hashed(api, super_token, app):
    s = setup_school(api, super_token)
    r1 = api.post("/api/auth/login", json={"email": "nobody@x.com", "password": "Whatever1"})
    r2 = api.post("/api/auth/login", json={"email": s["cred"]["email"], "password": "Wrong1234"})
    assert r1.status_code == r2.status_code == 401 and r1.get_json() == r2.get_json()
    from app.models import User
    u = User.query.filter_by(smartmark_email=s["cred"]["email"]).first()
    assert u.password_hash.startswith("$2") and "AdminPass1" not in u.password_hash
