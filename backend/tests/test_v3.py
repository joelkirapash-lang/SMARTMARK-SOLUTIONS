from tests.conftest import setup_school, create_account


def _sid(api, tok):
    return api.get("/api/super/schools", tok).get_json()[0]["id"]


def test_admins_have_positions_visible_on_the_school_and_feed_the_report_card(api, super_token):
    s = setup_school(api, super_token)
    sid = _sid(api, super_token)
    r = api.post(f"/api/super/schools/{sid}/admins", super_token, json={"first_name": "Peter", "second_name": "Kiprop", "job_title": "Chairperson"}).get_json()
    assert r["credentials"]["job_title"] == "Chairperson"
    api.post(f"/api/super/schools/{sid}/admins", super_token, json={"first_name": "Mary", "second_name": "Wanjiku", "job_title": "Computer patron"})
    row = api.get("/api/super/schools", super_token).get_json()[0]
    titles = {a["full_name"]: a["job_title"] for a in row["admin_users"]}
    assert titles["Peter Kiprop"] == "Chairperson" and titles["Mary Wanjiku"] == "Computer patron"
    assert len(row["admin_users"]) == 3 and row["usage"]["admins"] == 3
    pid = next(a["id"] for a in row["admin_users"] if a["full_name"] == "Peter Kiprop")
    assert api.put(f"/api/super/users/{pid}", super_token, json={"job_title": "Head teacher"}).get_json()["job_title"] == "Head teacher"
    assert api.put(f"/api/super/users/{pid}", s["admin"], json={"job_title": "x"}).status_code == 403
    assert api.put(f"/api/super/users/{pid}", super_token, json={"first_name": " "}).status_code == 400
    cred = r["credentials"]
    tok = api.login(cred["email"], cred["password"])
    api.post("/api/auth/change-password", tok, json={"current_password": cred["password"], "new_password": "NewPass123"})
    tok = api.login(cred["email"], "NewPass123")
    assert api.get("/api/auth/me", tok).get_json()["user"]["job_title"] == "Head teacher"
    # the head teacher's name fills the report card until the school types one in settings
    j, _, _ = create_account(api, s["admin"], role="STUDENT", first_name="Amy", second_name="Zed", admission_number="1",
                             grade_id=s["grade"]["id"], stream_id=s["stream"]["id"])
    exam = api.post("/api/exams", s["admin"], json={"name": "T1"}).get_json()
    api.post("/api/marks/grid", s["admin"], json={"exam_id": exam["id"], "grade_id": s["grade"]["id"], "stream_id": s["stream"]["id"],
             "subject_id": s["math"]["id"], "rows": [{"student_id": j["user"]["id"], "score": 70}]})
    card = lambda: api.get(f"/api/reports/card?student_id={j['user']['id']}&exam_id={exam['id']}", s["admin"]).get_json()
    assert card()["school"]["head_teacher_name"] == "Peter Kiprop"
    api.put("/api/school", s["admin"], json={"head_teacher_name": "Simon Kirapash"})
    assert card()["school"]["head_teacher_name"] == "Simon Kirapash"


def test_pulse_changes_only_when_that_schools_data_changes(api, super_token):
    a = setup_school(api, super_token, "Alpha School")
    b = setup_school(api, super_token, "Beta School")
    tok = lambda t: api.get("/api/pulse", t).get_json()["token"]
    pa, pb, ps = tok(a["admin"]), tok(b["admin"]), tok(super_token)
    assert tok(a["admin"]) == pa                                   # nothing happened: unchanged
    api.post("/api/grades", a["admin"], json={"name": "Grade 9"})
    assert tok(a["admin"]) != pa                                   # a change is noticed
    assert tok(b["admin"]) == pb                                   # another school is not disturbed
    assert tok(super_token) != ps                                  # the platform owner sees everything
    assert api.get("/api/pulse").status_code == 401
