"""Fixtures for the auth suite. Points the ``default`` connection at a fresh,
migrated throwaway SQLite file (auth/sessions/contenttypes/mango_auth) so login
sessions and preferences have real tables without touching the developer's
``.django-test.sqlite3``. Unlike the rest of the suite, these tests run with the
real ``IsAuthenticated`` default (see the root conftest exemption)."""

from __future__ import annotations

import pytest
from django.core.management import call_command
from django.db import connections


@pytest.fixture
def auth_db(tmp_path, django_db_blocker):
    tmp = tmp_path / "auth.sqlite3"
    conn = connections["default"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    try:
        with django_db_blocker.unblock():
            # Migrate every default-database app (auth, contenttypes, sessions,
            # mango_auth) into the throwaway file.
            call_command("migrate", database="default", verbosity=0)
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original
