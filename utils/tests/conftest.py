from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connections
from rest_framework.permissions import IsAuthenticated


@pytest.fixture(scope="session")
def django_db_setup():
    pass


@pytest.fixture(autouse=True)
def _relax_api_auth_for_legacy_tests(request, monkeypatch):
    """The platform now defaults to ``IsAuthenticated`` on every endpoint. The
    per-app API tests predate the auth layer and exercise business logic against
    an open API, so neutralize that permission for them by making
    ``IsAuthenticated`` always pass.

    Patching the permission itself (rather than the DRF default setting) is
    required because DRF binds ``permission_classes`` onto each view at import
    time — overriding the setting afterward would not reach already-imported
    views.

    Two suites are exempt so they keep exercising real enforcement:
    ``utils/tests/utils/shared/auth/``, where the lockdown (unauthenticated →
    403) is proven, and ``utils/tests/utils/shared/llm/``, where the provider
    API must stay refused to anonymous callers — it can trigger outbound
    requests and it handles API keys."""
    path = str(getattr(request.node, "fspath", "")).replace("\\", "/")
    if "/utils/shared/auth/" in path or "/utils/shared/llm/" in path:
        return
    monkeypatch.setattr(IsAuthenticated, "has_permission", lambda self, req, view: True)


@pytest.fixture
def exercise_db(tmp_path, django_db_blocker):
    """Point the ``exercise`` connection at a throwaway copy of the real workout
    database.

    The live data file (``data/exercise/workouttracker.db``) is never read or
    written by the suite — each test gets a fresh per-test copy. Yields the temp
    DB path.
    """
    src = Path(settings.DATABASES["exercise"]["NAME"])
    tmp = tmp_path / "workouttracker.db"
    shutil.copy2(src, tmp)

    conn = connections["exercise"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    try:
        with django_db_blocker.unblock():
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original


@pytest.fixture
def projectmanager_db(tmp_path, django_db_blocker):
    """Point the ``projectmanager`` connection at a throwaway copy of the real
    project-manager database.

    The live data file (``data/projectmanager/projectmanager.db``) is never read
    or written by the suite — each test gets a fresh per-test copy. Yields the
    temp DB path.
    """
    src = Path(settings.DATABASES["projectmanager"]["NAME"])
    tmp = tmp_path / "projectmanager.db"
    shutil.copy2(src, tmp)

    conn = connections["projectmanager"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    try:
        with django_db_blocker.unblock():
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original


@pytest.fixture
def imdbspy_db(tmp_path, django_db_blocker):
    """Point the ``imdbspy`` connection at a fresh, migrated temp database.

    Unlike exercise/projectmanager (which copy a live legacy file), IMDbSpy owns
    its schema via managed models, so this fixture creates an empty DB and runs
    the app's migrations into it — including the seed migration that inserts the
    three default weight scales. The live ``data/imdbspy/imdbtracker.db`` is
    never touched. Yields the temp DB path.
    """
    from django.core.management import call_command

    tmp = tmp_path / "imdbtracker.db"
    conn = connections["imdbspy"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    try:
        with django_db_blocker.unblock():
            call_command("migrate", "imdbspy", database="imdbspy", verbosity=0)
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original


@pytest.fixture
def timekeeper_db(tmp_path, django_db_blocker):
    """Point the ``timekeeper`` connection at a throwaway copy of the real
    time-keeper database.

    The live data file (``data/timekeeper/timekeeper.db``) is never read or
    written by the suite — each test gets a fresh per-test copy. Yields the temp
    DB path.
    """
    src = Path(settings.DATABASES["timekeeper"]["NAME"])
    tmp = tmp_path / "timekeeper.db"
    shutil.copy2(src, tmp)

    conn = connections["timekeeper"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    try:
        with django_db_blocker.unblock():
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original


@pytest.fixture
def recipes_db(tmp_path, django_db_blocker):
    """Point the ``recipes`` connection at a fresh, seeded throwaway database.

    Unlike the exercise/projectmanager apps there is no committed live DB to copy:
    ``store.ensure_initialized()`` creates the schema and seeds the sample recipes
    into the empty temp file. Yields the temp DB path.
    """
    from utils.apps.recipes.backend.services import store

    tmp = tmp_path / "recipes.db"
    conn = connections["recipes"]
    conn.close()
    original = conn.settings_dict["NAME"]
    conn.settings_dict["NAME"] = str(tmp)
    store._initialized_paths.discard(str(tmp))
    try:
        with django_db_blocker.unblock():
            store.ensure_initialized()
            yield tmp
    finally:
        conn.close()
        conn.settings_dict["NAME"] = original
        store._initialized_paths.discard(str(tmp))
