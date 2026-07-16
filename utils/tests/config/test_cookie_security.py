"""Regression tests for cookie/CSRF security wiring in ``config.django.settings``.

These flags are computed from environment variables at *import time*, so each
case imports the settings module in a fresh subprocess with a specific env and
reads back the resolved values.

Guards the http-lockout footgun: a ``DJANGO_DEBUG=false`` box browsed over plain
http drops ``Secure`` cookies, so the session never persists and every gated
request 403s. ``DJANGO_COOKIE_SECURE`` must be able to opt out without regressing
the production (Secure-by-default when DEBUG is off) posture.
"""

from __future__ import annotations

import json
import subprocess
import sys

_PROBE = (
    "import json;"
    "from config.django import settings as s;"
    "print(json.dumps({"
    "'SESSION_COOKIE_SECURE': s.SESSION_COOKIE_SECURE,"
    "'CSRF_COOKIE_SECURE': s.CSRF_COOKIE_SECURE,"
    "'COOKIE_SECURE': s.COOKIE_SECURE,"
    "'CSRF_TRUSTED_ORIGINS': s.CSRF_TRUSTED_ORIGINS,"
    "'HAS_PROXY_SSL': hasattr(s, 'SECURE_PROXY_SSL_HEADER'),"
    "}))"
)


def _resolve(env_overrides: dict[str, str]) -> dict:
    import os

    env = dict(os.environ)
    # Drop anything that would leak from the caller's shell into the case.
    for key in ("DJANGO_DEBUG", "DJANGO_COOKIE_SECURE", "DJANGO_BEHIND_TLS_PROXY"):
        env.pop(key, None)
    env.update(env_overrides)
    out = subprocess.check_output([sys.executable, "-c", _PROBE], env=env, text=True)
    return json.loads(out.strip().splitlines()[-1])


def test_debug_true_cookies_not_secure_and_dev_origins_trusted():
    r = _resolve({"DJANGO_DEBUG": "true"})
    assert r["SESSION_COOKIE_SECURE"] is False
    assert r["CSRF_COOKIE_SECURE"] is False
    # Vite dev origin plus its fallback ports are trusted.
    assert "http://localhost:5173" in r["CSRF_TRUSTED_ORIGINS"]
    assert "http://localhost:5174" in r["CSRF_TRUSTED_ORIGINS"]
    assert "http://127.0.0.1:5174" in r["CSRF_TRUSTED_ORIGINS"]


def test_debug_false_defaults_to_secure_cookies():
    # Production posture is preserved: DEBUG off => Secure cookies by default.
    r = _resolve({"DJANGO_DEBUG": "false"})
    assert r["SESSION_COOKIE_SECURE"] is True
    assert r["CSRF_COOKIE_SECURE"] is True
    # No http dev origins are trusted once cookies are Secure.
    assert not any(o.startswith("http://localhost") for o in r["CSRF_TRUSTED_ORIGINS"])


def test_debug_false_over_http_can_opt_out_of_secure():
    # The reported bug: DEBUG off but served over http://localhost. The override
    # drops Secure so the session cookie persists, and dev origins come back so
    # CSRF passes.
    r = _resolve({"DJANGO_DEBUG": "false", "DJANGO_COOKIE_SECURE": "false"})
    assert r["SESSION_COOKIE_SECURE"] is False
    assert r["CSRF_COOKIE_SECURE"] is False
    assert "http://localhost:5174" in r["CSRF_TRUSTED_ORIGINS"]


def test_debug_true_can_force_secure_cookies():
    r = _resolve({"DJANGO_DEBUG": "true", "DJANGO_COOKIE_SECURE": "true"})
    assert r["SESSION_COOKIE_SECURE"] is True
    assert r["CSRF_COOKIE_SECURE"] is True


def test_behind_tls_proxy_sets_forwarded_proto_header():
    r = _resolve({"DJANGO_DEBUG": "false", "DJANGO_BEHIND_TLS_PROXY": "true"})
    assert r["HAS_PROXY_SSL"] is True
    assert r["SESSION_COOKIE_SECURE"] is True
