import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import User, SUPER_ADMIN
from app.utils.security import hash_password


@pytest.fixture()
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        db.session.add(User(role=SUPER_ADMIN, first_name="Dev", smartmark_email="dev@smartmarksolutions.com",
                            password_hash=hash_password("SuperPass1")))
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


class Api:
    def __init__(self, client):
        self.c = client

    def req(self, method, path, token=None, **kw):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return getattr(self.c, method)(path, headers=headers, **kw)

    def get(self, path, token=None):
        return self.req("get", path, token)

    def post(self, path, token=None, json=None, **kw):
        if "data" in kw:
            return self.req("post", path, token, **kw)
        return self.req("post", path, token, json=json or {}, **kw)

    def put(self, path, token=None, json=None):
        return self.req("put", path, token, json=json or {})

    def delete(self, path, token=None):
        return self.req("delete", path, token)

    def login(self, email, password):
        r = self.post("/api/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.get_json()
        return r.get_json()["access_token"]


@pytest.fixture()
def api(client):
    return Api(client)


@pytest.fixture()
def super_token(api):
    return api.login("dev@smartmarksolutions.com", "SuperPass1")


def make_school(api, super_token, name="Anestar Secondary", **extra):
    r = api.post("/api/super/schools", super_token, json={
        "school_name": name, "admin_first_name": "Jane", "admin_second_name": "Mwangi", **extra})
    assert r.status_code == 201, r.get_json()
    cred = r.get_json()["credentials"]
    # first login forces a password change
    tok = api.login(cred["email"], cred["password"])
    assert api.get("/api/grades", tok).status_code == 403
    r = api.post("/api/auth/change-password", tok, json={"current_password": cred["password"], "new_password": "AdminPass1"})
    assert r.status_code == 200
    tok = api.login(cred["email"], "AdminPass1")
    return r, cred, tok, r.get_json


def setup_school(api, super_token, name="Anestar Secondary", **extra):
    _, cred, admin_tok, _ = make_school(api, super_token, name, **extra)
    g = api.post("/api/grades", admin_tok, json={"name": "Grade 4", "order_index": 4}).get_json()
    st = api.post("/api/streams", admin_tok, json={"name": "A", "grade_id": g["id"]}).get_json()
    sub = api.post("/api/subjects", admin_tok, json={"name": "Mathematics", "code": "MATH"}).get_json()
    sub2 = api.post("/api/subjects", admin_tok, json={"name": "English", "code": "ENG"}).get_json()
    api.post("/api/academics/cbc-bands", admin_tok)
    return {"admin": admin_tok, "grade": g, "stream": st, "math": sub, "eng": sub2, "cred": cred}


def create_account(api, tok, **data):
    r = api.post("/api/accounts", tok, json=data)
    assert r.status_code == 201, r.get_json()
    j = r.get_json()
    pw = j["credentials"]["password"]
    user_tok = api.login(j["credentials"]["email"], pw)
    return j, pw, user_tok
