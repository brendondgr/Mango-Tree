"""Stage 7 verification: non-interactive Strava import. The network and fetch
seams are injected, so these tests need neither network access nor stravalib."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import yaml
from django.conf import settings
from django.test import Client

from utils.apps.exercise.agent import tools
from utils.apps.exercise.backend.services import history as history_service
from utils.apps.exercise.backend.services import strava
from utils.apps.exercise.shared.errors import PermissionDeniedError, ValidationError

STRAVA_ENV = (
    "STRAVA_CLIENT",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_ACCESS_TOKEN",
    "STRAVA_REFRESH_TOKEN",
)


@pytest.fixture
def no_strava_env(monkeypatch):
    for key in STRAVA_ENV:
        monkeypatch.delenv(key, raising=False)


class _FakeActivity:
    def __init__(self, id, name, type_, dt, distance_m, moving_s):
        self.id = id
        self.name = name
        self.type = type_
        self.start_date_local = dt
        self.distance = distance_m
        self.moving_time = timedelta(seconds=moving_s)


class _FakeClient:
    def __init__(self, activities, athlete_ok=True):
        self._activities = activities
        self._athlete_ok = athlete_ok
        self.access_token = None
        self.refreshed = False

    def get_athlete(self):
        if not self._athlete_ok:
            raise Exception("Unauthorized")
        return {"id": 1}

    def refresh_access_token(self, **kwargs):
        self.refreshed = True
        return {"access_token": "new-access", "refresh_token": "new-refresh"}

    def get_activities(self, after=None):
        return self._activities


def _creds(access_token="tok", refresh_token="ref"):
    return strava.StravaCredentials(
        client_id="cid",
        client_secret="secret",
        access_token=access_token,
        refresh_token=refresh_token,
    )


# --- validation / credentials -------------------------------------------------

def test_fetch_rejects_bad_period():
    with pytest.raises(ValidationError):
        strava.fetch_strava_activities("month", credentials=_creds())


def test_sync_rejects_bad_period():
    with pytest.raises(ValidationError):
        strava.sync_strava("month")


def test_missing_credentials_raise_permission_denied(no_strava_env):
    with pytest.raises(PermissionDeniedError):
        strava.fetch_strava_activities("week")


# --- fetch + normalization (injected client) ----------------------------------

def test_fetch_normalizes_run_and_walk_only():
    activities = [
        _FakeActivity("1", "Morning Run", "Run", datetime(2026, 6, 1, 7, 30), 5000.0, 1800),
        _FakeActivity("2", "Bike", "Ride", datetime(2026, 6, 1, 8, 0), 20000.0, 3600),
        _FakeActivity("3", "Evening Walk", "Walk", datetime(2026, 6, 2, 18, 0), 3000.0, 1500),
    ]
    client = _FakeClient(activities)
    result = strava.fetch_strava_activities(
        "all", credentials=_creds(), client_factory=lambda: client
    )
    assert [a["Type"] for a in result] == ["Run", "Walk"]
    assert result[0]["Distance (miles)"] == 3.11  # 5000m -> miles, 2dp
    assert result[0]["date"] == "2026-06-01"
    assert result[0]["start_time"] == "07:30:00"


@pytest.mark.needs_legacy_data
def test_fetch_refreshes_when_access_token_invalid():
    client = _FakeClient([], athlete_ok=False)
    strava.fetch_strava_activities(
        "week", credentials=_creds(access_token="stale"), client_factory=lambda: client
    )
    assert client.refreshed is True
    assert client.access_token == "new-access"


@pytest.mark.needs_legacy_data
def test_fetch_denied_when_unauthorized_and_no_refresh_token():
    client = _FakeClient([], athlete_ok=False)
    with pytest.raises(PermissionDeniedError):
        strava.fetch_strava_activities(
            "week",
            credentials=_creds(access_token="stale", refresh_token=None),
            client_factory=lambda: client,
        )


# --- sync orchestration (injected fetch, real temp DB) ------------------------

def test_sync_imports_then_dedups():
    fake = [
        {"id": "555", "Name": "Run A", "Type": "Run", "date": "2026-06-10",
         "start_time": "06:00:00", "Distance (miles)": 3.1, "Moving Time (s)": 1700},
        {"id": "556", "Name": "Walk B", "Type": "Walk", "date": "2026-06-11",
         "start_time": "19:00:00", "Distance (miles)": 1.0, "Moving Time (s)": 900},
    ]
    before = len(history_service.list_history())

    first = strava.sync_strava("week", fetch=lambda period: fake)
    assert first == {"fetched": 2, "imported": 2, "skipped": 0}
    assert len(history_service.list_history()) == before + 2
    # imported logs use run/walk workout ids
    assert history_service.get_log("strava_555").workout_id == "run"

    second = strava.sync_strava("week", fetch=lambda period: fake)
    assert second == {"fetched": 2, "imported": 0, "skipped": 2}


# --- API + agent tool ---------------------------------------------------------

def test_api_strava_sync_without_credentials_returns_403(no_strava_env):
    res = Client().post("/api/exercise/strava/sync/", data="{}", content_type="application/json")
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_strava_tool_returns_structured_summary():
    mock = MagicMock()
    mock.sync_strava.return_value = {"fetched": 1, "imported": 1, "skipped": 0}
    payload = tools.sync_strava(period="week", service=mock)
    assert payload["strava_sync"]["imported"] == 1
    mock.sync_strava.assert_called_once_with("week")


def test_strava_tool_surfaces_permission_denied():
    mock = MagicMock()
    mock.sync_strava.side_effect = PermissionDeniedError("no creds")
    payload = tools.sync_strava(period="week", service=mock)
    assert payload["error"]["code"] == "permission_denied"


def test_persist_tokens_writes_file_when_configured(monkeypatch, tmp_path):
    token_file = tmp_path / "tokens.json"
    monkeypatch.setenv("MANGO_STRAVA_TOKEN_FILE", str(token_file))
    strava._persist_tokens("a", "b")
    assert '"access_token": "a"' in token_file.read_text()


# --- config consistency -------------------------------------------------------

def test_permissions_declare_strava_network_scope():
    config = yaml.safe_load((Path(settings.BASE_DIR) / "config" / "permissions.yaml").read_text())
    scope = config["network"]["exercise_strava"]
    assert "https" in scope["allow_schemes"]
    assert "www.strava.com" in scope["allow_hosts"]
