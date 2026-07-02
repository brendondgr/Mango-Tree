"""DRF API tests for the auth surface: signup/login/logout/me/preferences, the
global unauthenticated lockdown (denial), and IP lockout + unlock over HTTP.

These run with the real ``IsAuthenticated`` default (root conftest exempts the
auth suite from the relax fixture)."""

from __future__ import annotations

import json

from django.test import Client

from utils.shared.auth.constants import MAX_FAILED_ATTEMPTS

STRONG = "correct horse staple 42"


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _signup_owner(client, username="owner", password=STRONG):
    return _post(client, "/api/auth/signup/", {"username": username, "password": password})


# --- denial: everything is gated by default -----------------------------------


def test_unauthenticated_is_denied(auth_db):
    client = Client()
    assert client.get("/api/auth/me/").status_code == 403
    # The lockdown covers the app endpoints too, not just the auth surface.
    assert client.get("/api/recipes/recipes/").status_code == 403


def test_health_and_public_endpoints_stay_open(auth_db):
    client = Client()
    assert client.get("/api/health/").status_code == 200
    assert client.get("/api/auth/csrf/").status_code == 200
    assert client.get("/api/auth/registration-status/").status_code == 200


# --- owner signup + session login ---------------------------------------------


def test_signup_creates_owner_and_logs_in(auth_db):
    client = Client()
    status_resp = client.get("/api/auth/registration-status/").json()
    assert status_resp == {"registration_open": True, "owner_exists": False}

    resp = _signup_owner(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "owner"
    assert body["is_owner"] is True
    assert body["preferences"] == {
        "enabled_apps": ["mediaviewer"],
        "onboarding_completed": False,
    }

    # Session established by signup: me works on the same client.
    assert client.get("/api/auth/me/").status_code == 200
    # Registration is now closed.
    assert client.get("/api/auth/registration-status/").json()["registration_open"] is False


def test_second_signup_is_rejected(auth_db):
    _signup_owner(Client())
    resp = _signup_owner(Client(), username="intruder", password="another strong pass 99")
    assert resp.status_code == 403
    assert resp.json()["code"] == "permission_denied"


def test_signup_weak_password_rejected(auth_db):
    resp = _signup_owner(Client(), password="short")
    assert resp.status_code == 400
    assert resp.json()["code"] == "validation_error"


def test_login_logout_cycle(auth_db):
    _signup_owner(Client())

    client = Client()
    bad = _post(client, "/api/auth/login/", {"username": "owner", "password": "nope"})
    assert bad.status_code == 400
    assert bad.json()["code"] == "validation_error"

    good = _post(client, "/api/auth/login/", {"username": "owner", "password": STRONG})
    assert good.status_code == 200
    assert good.json()["username"] == "owner"

    assert client.post("/api/auth/logout/").status_code == 204
    assert client.get("/api/auth/me/").status_code == 403


def test_preferences_get_and_patch(auth_db):
    client = Client()
    _signup_owner(client)

    patched = client.patch(
        "/api/auth/preferences/",
        data=json.dumps({"enabled_apps": ["mediaviewer", "calendar"], "onboarding_completed": True}),
        content_type="application/json",
    )
    assert patched.status_code == 200
    assert patched.json() == {
        "enabled_apps": ["mediaviewer", "calendar"],
        "onboarding_completed": True,
    }
    assert client.get("/api/auth/preferences/").json()["onboarding_completed"] is True


# --- IP lockout over HTTP -----------------------------------------------------


def test_login_lockout_and_unlock(auth_db):
    owner = Client()
    _signup_owner(owner)  # owner keeps an authenticated session

    attacker = Client()
    for _ in range(MAX_FAILED_ATTEMPTS):
        resp = _post(attacker, "/api/auth/login/", {"username": "owner", "password": "wrong"})
        assert resp.status_code == 400

    # Even the correct password is refused once the IP is locked.
    locked = _post(attacker, "/api/auth/login/", {"username": "owner", "password": STRONG})
    assert locked.status_code == 429
    assert locked.json()["code"] == "rate_limited"
    assert "Retry-After" in locked

    # Owner sees the lockout and clears it.
    lockouts = owner.get("/api/auth/security/lockouts/").json()["lockouts"]
    assert any(item["ip_address"] == "127.0.0.1" for item in lockouts)

    unlock = _post(owner, "/api/auth/security/unlock/", {"ip_address": "127.0.0.1"})
    assert unlock.status_code == 200
    assert unlock.json()["cleared"] == MAX_FAILED_ATTEMPTS

    # Login works again after the unlock.
    recovered = _post(attacker, "/api/auth/login/", {"username": "owner", "password": STRONG})
    assert recovered.status_code == 200


def test_security_attempts_requires_auth(auth_db):
    assert Client().get("/api/auth/security/attempts/").status_code == 403

    owner = Client()
    _signup_owner(owner)
    _post(Client(), "/api/auth/login/", {"username": "owner", "password": "wrong"})
    attempts = owner.get("/api/auth/security/attempts/").json()["attempts"]
    # At least the successful signup + the failed login are logged.
    assert any(a["successful"] for a in attempts)
    assert any(not a["successful"] for a in attempts)
