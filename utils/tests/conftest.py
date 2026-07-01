from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connections


@pytest.fixture(scope="session")
def django_db_setup():
    pass


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
