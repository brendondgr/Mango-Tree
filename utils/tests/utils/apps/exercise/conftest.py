from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connections


@pytest.fixture(autouse=True)
def exercise_db(tmp_path, django_db_blocker):
    """Point the ``exercise`` connection at a throwaway copy of the real
    workout database.

    Every exercise test runs against a fresh per-test copy, so the live data
    file (``data/exercise/workouttracker.db``) is never read or written by the
    suite. The fixture yields the temp DB path.
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
