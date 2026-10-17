import io

from tests.conftest import setup_school, create_account

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _student(api, s, first, adm, **extra):
    j, _, _ = create_account(api, s["admin"], role="STUDENT", first_name=first, second_name="Test", admission_number=adm,
                             grade_id=s["grade"]["id"], stream_id=s["stream"]["id"], **extra)
    return j["user"]["id"]


def _save(api, s, exam, subject_id, rows):
    r = api.post("/api/marks/grid", s["admin"], json={"exam_id": exam["id"], "grade_id": s["grade"]["id"],
                 "stream_id": s["stream"]["id"], "subject_id": subject_id, "rows": rows})
    assert r.status_code == 200 and not r.get_json()["errors"], r.get_json()


def test_eight_level_scale_and_automatic_remarks_match_the_kenyan_card(api, super_token):
    s = setup_school(api, super_token)
    assert api.post("/api/academics/cbc-bands", s["admin"], json={"scale": 8}).status_code == 400   # 4-level already loaded
    r = api.post("/api/academics/cbc-bands", s["admin"], json={"scale": 8, "replace": True})
    assert r.get_json() == {"added": 8}
    assert [b["code"] for b in api.get("/api/performance-bands", s["admin"]).get_json()] == \
        ["BE1", "BE2", "AE1", "AE2", "ME1", "ME2", "EE1", "EE2"]
    teacher, _, _ = create_account(api, s["admin"], role="TEACHER", first_name="Sianto", second_name="Setek",
                                   home_grade_id=s["grade"]["id"], home_stream_id=s["stream"]["id"])
    kid = _student(api, s, "Josphat", "7001", upi_number="UPI-9", assessment_number="B001769705")
    exam = api.post("/api/exams", s["admin"], json={"name": "END TERM EXAM", "term": "Term 3 2026"}).get_json()
    scores = {"English": 63, "Kiswahili": 74, "Mathematics": 40, "Integrated Science": 10, "Agriculture and Nutrition": 67,
              "Social Studies": 56, "Religious Education": 64, "Creative Arts and Sports": 43, "Pre-Technical Studies": 36}
    ids = {"English": s["eng"]["id"], "Mathematics": s["math"]["id"]}
    for i, name in enumerate(n for n in scores if n not in ids):
        ids[name] = api.post("/api/subjects", s["admin"], json={"name": name, "code": f"S{i}"}).get_json()["id"]
    for name, score in scores.items():
        _save(api, s, exam, ids[name], [{"student_id": kid, "score": score, "remark": "Great effort" if name == "English" else ""}])
    card = api.get(f"/api/reports/card?student_id={kid}&exam_id={exam['id']}", s["admin"]).get_json()
    bands = {r["subject"]: r["band"] for r in card["subjects"]}
    assert bands == {"English": "ME2", "Kiswahili": "EE1", "Mathematics": "AE2", "Integrated Science": "BE1",
                     "Agriculture and Nutrition": "ME2", "Social Studies": "ME1", "Religious Education": "ME2",
                     "Creative Arts and Sports": "AE2", "Pre-Technical Studies": "AE2"}
    assert card["total"] == 453 and card["average"] == 50.3 and card["overall_band"] == "ME1"
    assert card["overall_label"] == "Meeting Expectation 1" and card["position"] == 1 and card["class_size"] == 1
    assert card["head_teacher_remark"] == "A fair attempt by JOSPHAT at 50.3%. Extra attention to weaker areas is encouraged."
    assert "Strongest in Kiswahili" in card["class_teacher_remark"] and "Integrated Science" in card["class_teacher_remark"]
    eng = next(r for r in card["subjects"] if r["subject"] == "English")
    sci = next(r for r in card["subjects"] if r["subject"] == "Integrated Science")
    assert eng["remark"] == "Great effort" and eng["remark_auto"] is False          # teacher's own words win
    assert sci["remark"] == "Needs urgent improvement. Extra support is required." and sci["remark_auto"] is True
    assert card["student"]["class_teacher"] == "Sianto Setek"
    assert card["student"]["upi"] == "UPI-9" and card["student"]["assessment_number"] == "B001769705"


def test_remark_wording_follows_the_level_from_excellent_to_fail(api, super_token):
    from app.models import PerformanceBand
    from app.utils.remarks import tier_for
    s = setup_school(api, super_token)
    api.post("/api/academics/cbc-bands", s["admin"], json={"scale": 8, "replace": True})
    from app.models import School
    bands = PerformanceBand.query.order_by(PerformanceBand.min_score).all()
    assert [tier_for(bands, p) for p in (95, 75, 65, 55, 40, 30, 15, 5)] == \
        ["excellent", "very_good", "good", "fair", "weak", "weak", "very_weak", "very_weak"]
    assert tier_for([], 85) == "excellent" and tier_for([], 12) == "very_weak"


def test_marklist_has_subject_means_class_summary_and_class_teacher(api, super_token):
    s = setup_school(api, super_token)
    api.post("/api/academics/cbc-bands", s["admin"], json={"scale": 8, "replace": True})
    create_account(api, s["admin"], role="TEACHER", first_name="Mary", second_name="Wafula",
                   home_grade_id=s["grade"]["id"], home_stream_id=s["stream"]["id"])
    a, b = _student(api, s, "Ann", "1"), _student(api, s, "Bob", "2")
    exam = api.post("/api/exams", s["admin"], json={"name": "T1"}).get_json()
    _save(api, s, exam, s["math"]["id"], [{"student_id": a, "score": 80}, {"student_id": b, "score": 40}])
    _save(api, s, exam, s["eng"]["id"], [{"student_id": a, "score": 60}, {"student_id": b, "score": 50}])
    ml = api.get(f"/api/marklist?exam_id={exam['id']}&grade_id={s['grade']['id']}&stream_id={s['stream']['id']}", s["admin"]).get_json()
    stats = {x["subject_id"]: x for x in ml["subject_stats"]}
    assert stats[s["math"]["id"]]["mean"] == 60 and stats[s["math"]["id"]]["total"] == 120
    assert ml["grand_total"] == 230 and ml["class_mean"] == 57.5 and ml["class_band"] == "ME1" and ml["learners"] == 2
    assert ml["class_teacher"] == "Mary Wafula"


def test_image_uploads_are_validated_replaced_and_removable(api, super_token):
    s = setup_school(api, super_token)
    sid = api.get("/api/super/schools", super_token).get_json()[0]["id"]

    def up(tok, content, name="crest.png", kind="crest"):
        return api.post("/api/school/upload", tok, data={"kind": kind, "file": (io.BytesIO(content), name)},
                        content_type="multipart/form-data")

    r = up(s["admin"], PNG)
    assert r.status_code == 200
    url = r.get_json()["crest_url"]
    assert url.startswith(f"/api/files/{sid}/") and url.endswith(".png")
    res = api.get(url)                              # public: parent links need to show the crest
    assert res.status_code == 200 and res.mimetype == "image/png" and res.headers["X-Content-Type-Options"] == "nosniff"
    assert up(s["admin"], b"<script>alert(1)</script>", "evil.png").status_code == 400   # name lies, bytes decide
    assert up(s["admin"], PNG + b"0" * (2 * 1024 * 1024)).status_code == 400
    assert up(s["admin"], PNG, kind="malware").status_code == 400
    new = up(s["admin"], PNG, kind="crest").get_json()["crest_url"]
    assert new != url and api.get(url).status_code == 404            # old file cleaned up
    sig = up(s["admin"], PNG, kind="signature").get_json()
    assert sig["head_signature_url"] and sig["crest_url"] == new
    assert api.get(f"/api/files/{sid}/../x.png").status_code == 404
    j, _, ttok = create_account(api, s["admin"], role="TEACHER", first_name="Tee", second_name="Cher", must_change_password=False)
    assert up(ttok, PNG).status_code == 403                           # only admins
    assert api.put("/api/school", s["admin"], json={"crest_url": "javascript:alert(1)"}).status_code == 400
    assert api.put("/api/school", s["admin"], json={"head_teacher_name": "Simon Kirapash", "next_term_begins": "2027-01-04",
                                                     "stamp_url": "https://example.com/stamp.png"}).status_code == 200
    gone = api.delete("/api/school/upload/crest", s["admin"]).get_json()
    assert gone["crest_url"] is None and api.get(new).status_code == 404


def test_a_school_can_have_many_admins_with_identical_access(api, super_token):
    s = setup_school(api, super_token)
    sid = api.get("/api/super/schools", super_token).get_json()[0]["id"]
    r = api.post(f"/api/super/schools/{sid}/admins", super_token, json={"first_name": "Second", "second_name": "Admin"})
    assert r.status_code == 201 and r.get_json()["admins"] == 2
    cred = r.get_json()["credentials"]
    assert cred["email"].startswith("second.admin@admin.")
    t1 = api.login(cred["email"], cred["password"])
    api.post("/api/auth/change-password", t1, json={"current_password": cred["password"], "new_password": "Second1Pass"})
    t2 = api.login(cred["email"], "Second1Pass")
    assert [g["name"] for g in api.get("/api/grades", t2).get_json()] == ["Grade 4"]        # sees the same school
    api.post("/api/grades", t2, json={"name": "Grade 5", "order_index": 5})
    assert len(api.get("/api/grades", s["admin"]).get_json()) == 2                           # and the first admin sees the change
    third = api.post(f"/api/super/schools/{sid}/admins", super_token, json={"first_name": "Second", "second_name": "Admin"}).get_json()
    assert third["credentials"]["email"].startswith("second.admin2@admin.")                  # never overwritten
    stats = api.get("/api/super/stats", super_token).get_json()
    assert stats["admins"] == 3 and stats["all_schools"][0]["admins"] == 3
    admins = api.get(f"/api/super/schools/{sid}/users?role=SCHOOL_ADMIN", super_token).get_json()
    assert len(admins) == 3
    assert api.post(f"/api/super/schools/{sid}/admins", s["admin"], json={"first_name": "X"}).status_code == 403
    first_id = next(a["id"] for a in admins if a["smartmark_email"] == s["cred"]["email"])
    second_id = next(a["id"] for a in admins if a["smartmark_email"] == cred["email"])
    assert api.post(f"/api/super/users/{second_id}/status", super_token, json={"active": False}).status_code == 200
    login = api.post("/api/auth/login", json={"email": cred["email"], "password": "Second1Pass"})
    assert login.status_code == 403
    third_id = next(a["id"] for a in admins if a["id"] not in (first_id, second_id))
    api.post(f"/api/super/users/{third_id}/status", super_token, json={"active": False})
    last = api.post(f"/api/super/users/{first_id}/status", super_token, json={"active": False})
    assert last.status_code == 400 and "at least one" in last.get_json()["error"]
    assert api.post(f"/api/super/users/{second_id}/status", super_token, json={"active": True}).status_code == 200
