from __future__ import annotations

import json
import shutil
import sqlite3
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


def _skip_when_no_legacy_rows(request, db_path) -> None:
    """Skip a ``needs_legacy_data`` test when the bound database has no rows.

    The exercise, projectmanager and timekeeper apps bind ``managed = False`` to
    databases their standalone predecessors created. ``init_data.py`` gives a
    clean clone the *schemas*, but the rows are the maintainer's own data and are
    not in the repository — so tests asserting on counts, orderings or the seeded
    category taxonomy cannot pass anywhere else. They report as skipped, with the
    reason, rather than as failures: a suite that is permanently red for every
    reader is a suite nobody reads.
    """
    if request.node.get_closest_marker("needs_legacy_data") is None:
        return
    con = sqlite3.connect(str(db_path))
    try:
        tables = [
            r[0]
            for r in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%'"
            )
        ]
        for table in tables:
            if con.execute(f'SELECT 1 FROM "{table}" LIMIT 1').fetchone():
                return
    finally:
        con.close()
    pytest.skip(
        f"needs the legacy data in {db_path.name}; this clone has the schema but "
        "no rows (see README.md § Testing)"
    )


@pytest.fixture
def exercise_db(request, tmp_path, django_db_blocker):
    """Point the ``exercise`` connection at a throwaway copy of the real workout
    database.

    The live data file (``data/exercise/workouttracker.db``) is never read or
    written by the suite — each test gets a fresh per-test copy. Yields the temp
    DB path.
    """
    src = Path(settings.DATABASES["exercise"]["NAME"])
    tmp = tmp_path / "workouttracker.db"
    shutil.copy2(src, tmp)
    _skip_when_no_legacy_rows(request, tmp)

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
def projectmanager_db(request, tmp_path, django_db_blocker):
    """Point the ``projectmanager`` connection at a throwaway copy of the real
    project-manager database.

    The live data file (``data/projectmanager/projectmanager.db``) is never read
    or written by the suite — each test gets a fresh per-test copy. Yields the
    temp DB path.
    """
    src = Path(settings.DATABASES["projectmanager"]["NAME"])
    tmp = tmp_path / "projectmanager.db"
    shutil.copy2(src, tmp)
    _skip_when_no_legacy_rows(request, tmp)

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
def timekeeper_db(request, tmp_path, django_db_blocker):
    """Point the ``timekeeper`` connection at a throwaway copy of the real
    time-keeper database.

    The live data file (``data/timekeeper/timekeeper.db``) is never read or
    written by the suite — each test gets a fresh per-test copy. Yields the temp
    DB path.
    """
    src = Path(settings.DATABASES["timekeeper"]["NAME"])
    tmp = tmp_path / "timekeeper.db"
    shutil.copy2(src, tmp)
    _skip_when_no_legacy_rows(request, tmp)

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

@pytest.fixture
def artifact_store(tmp_path, monkeypatch):
    """Point the artifact tools at a throwaway store holding two real files.

    These tests used to read whatever happened to be in the maintainer's own
    ``data/artifacts`` manifest — two files named ``_test.png`` and ``1402.mp4``
    that no longer exist, so they failed everywhere including on the machine
    they were written on. The store is now built here: a real PNG written by
    Pillow and a real MP4 written by OpenCV, so ``read_artifact`` exercises the
    same base64 and poster-frame paths it does in production.

    Yields a dict with the store root and the two artifact records.
    """
    import cv2
    import numpy as np
    from PIL import Image

    from utils.agents.tools import registry as registry_module

    root = tmp_path / "artifacts"
    storage = root / "storage"
    storage.mkdir(parents=True)

    png = storage / "sample-image.png"
    Image.new("RGB", (16, 16), (200, 120, 40)).save(png, format="PNG")

    mp4 = storage / "sample-video.mp4"
    writer = cv2.VideoWriter(str(mp4), cv2.VideoWriter_fourcc(*"mp4v"), 5, (32, 32))
    for shade in range(5):
        writer.write(np.full((32, 32, 3), shade * 40, dtype=np.uint8))
    writer.release()

    records = [
        {
            "id": "art-image",
            "filename": "sample.png",
            "storage_path": "storage/sample-image.png",
            "kind": "image",
            "mime_type": "image/png",
        },
        {
            "id": "art-video",
            "filename": "sample.mp4",
            "storage_path": "storage/sample-video.mp4",
            "kind": "video",
            "mime_type": "video/mp4",
        },
    ]
    (root / "manifest.json").write_text(
        json.dumps({"artifacts": records}), encoding="utf-8"
    )

    monkeypatch.setattr(registry_module, "ARTIFACTS_DIR", str(root))
    yield {"root": root, "image": records[0], "video": records[1]}
