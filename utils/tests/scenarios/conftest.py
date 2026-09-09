"""Fixtures for the scenario suite: the all-apps sandbox and the report sink."""

from __future__ import annotations

import os

import pytest

from utils.tests.scenarios.harness import ReportSink, default_report_dir
from utils.tests.scenarios.sandbox import build_sandbox


@pytest.fixture
def sandbox(tmp_path, monkeypatch, exercise_db, projectmanager_db, timekeeper_db,
            imdbspy_db, recipes_db):
    """Every app store on a throwaway copy, every network seam faked, seeded.

    The five database fixtures come from the root ``conftest.py``; requesting
    them here binds all five connections at once so a mixed scenario can cross
    apps in a single run. Nothing under ``data/`` is read or written.
    """
    return build_sandbox(tmp_path / "sandbox", monkeypatch)


@pytest.fixture(scope="session")
def scenario_sink():
    """Collects every scenario run in the session and writes the report at exit.

    Output goes to ``.tool-scenarios/pytest/`` (gitignored) or wherever
    ``MANGO_SCENARIO_REPORT_DIR`` points.
    """
    sink = ReportSink()
    yield sink
    if sink.runs:
        target = default_report_dir() / "pytest"
        sink.write(target)


def live_llm_enabled() -> bool:
    return os.environ.get("MANGO_LIVE_LLM", "").strip().lower() in ("1", "true", "yes")


def live_llm_config():
    """``{provider, model}`` from ``MANGO_LIVE_PROVIDER`` / ``MANGO_LIVE_MODEL``,
    or ``None`` to use the registry's default provider and model."""
    cfg = {}
    provider = os.environ.get("MANGO_LIVE_PROVIDER", "").strip()
    model = os.environ.get("MANGO_LIVE_MODEL", "").strip()
    if provider:
        cfg["provider"] = provider
    if model:
        cfg["model"] = model
    return cfg or None
