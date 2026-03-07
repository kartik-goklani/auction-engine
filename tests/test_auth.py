"""
test_auth.py — Authentication endpoint E2E tests.

Covers:
  - POST /auth/register (vendor registration)
  - POST /auth/login
  - GET /auth/me
"""

import time
import requests
import pytest

BASE_URL = __import__("os").getenv("BASE_URL", "http://localhost:3001/api/v1")


def post(path: str, body: dict, headers: dict | None = None) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", json=body, headers=headers or {}, timeout=15)


def get(path: str, headers: dict) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=15)


# Use a unique email per test run to avoid conflicts across runs
_TS = str(int(time.time()))
NEW_VENDOR_EMAIL = f"newvendor_{_TS}@aitt.test"


class TestRegister:
    def test_register_vendor_success(self):
        resp = post("/auth/register", {
            "email": NEW_VENDOR_EMAIL,
            "password": "NewVend1234!",
            "companyName": "New Vendor Co",
            "contactName": "Test User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert "message" in data["data"]

    def test_register_duplicate_email_returns_conflict(self):
        resp = post("/auth/register", {
            "email": NEW_VENDOR_EMAIL,
            "password": "NewVend1234!",
            "companyName": "New Vendor Co",
            "contactName": "Test User",
        })
        assert resp.status_code == 409

    def test_register_missing_required_fields_returns_validation_error(self):
        resp = post("/auth/register", {
            "email": f"partial_{_TS}@aitt.test",
            "password": "Test1234!",
            # missing companyName and contactName
        })
        assert resp.status_code == 400
        error = resp.json()["error"]
        assert error["code"] in ("VALIDATION_ERROR", "BAD_REQUEST")

    def test_register_with_extra_field_returns_validation_error(self):
        """forbidNonWhitelisted: true must reject unknown fields."""
        resp = post("/auth/register", {
            "email": f"extra_{_TS}@aitt.test",
            "password": "Test1234!",
            "companyName": "Test Co",
            "contactName": "Test User",
            "role": "buyer",  # not in RegisterDto
        })
        assert resp.status_code == 400


class TestLogin:
    def test_login_success_returns_token_and_role(self):
        resp = post("/auth/login", {
            "email": "vendor1@aitt.test",
            "password": "Seed1234!",
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "accessToken" in data
        assert data["user"]["role"] == "vendor"
        assert data["user"]["email"] == "vendor1@aitt.test"

    def test_buyer_login_returns_buyer_role(self):
        resp = post("/auth/login", {
            "email": "buyer1@aitt.test",
            "password": "Seed1234!",
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["user"]["role"] == "buyer"

    def test_login_wrong_password_returns_unauthorized(self):
        resp = post("/auth/login", {
            "email": "vendor1@aitt.test",
            "password": "WrongPassword999!",
        })
        assert resp.status_code in (400, 401)

    def test_login_unknown_email_returns_error(self):
        resp = post("/auth/login", {
            "email": "nobody@aitt.test",
            "password": "Seed1234!",
        })
        assert resp.status_code in (400, 401)

    def test_login_response_has_standard_envelope(self):
        resp = post("/auth/login", {
            "email": "vendor1@aitt.test",
            "password": "Seed1234!",
        })
        body = resp.json()
        assert "success" in body
        assert "meta" in body
        assert "requestId" in body["meta"]
        assert "timestamp" in body["meta"]


class TestMe:
    def test_get_me_returns_authenticated_user(self, vendor1_headers):
        resp = get("/auth/me", vendor1_headers)
        assert resp.status_code == 200
        user = resp.json()["data"]
        assert user["email"] == "vendor1@aitt.test"
        assert user["role"] == "vendor"
        assert "id" in user

    def test_get_me_without_token_returns_unauthorized(self):
        resp = get("/auth/me", {})
        assert resp.status_code == 401

    def test_get_me_with_invalid_token_returns_unauthorized(self):
        resp = get("/auth/me", {"Authorization": "Bearer not.a.real.token"})
        assert resp.status_code == 401

    def test_error_response_has_standard_envelope(self):
        resp = get("/auth/me", {})
        body = resp.json()
        assert body["success"] is False
        assert "error" in body
        assert "code" in body["error"]
        assert "message" in body["error"]
