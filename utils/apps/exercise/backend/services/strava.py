"""Strava activity import (non-interactive).

The legacy WorkoutTracker performed a blocking, console-based OAuth bootstrap
(``input()``) and rewrote a ``.env`` file. That cannot run on a server or from
an agent, so this port:

- reads credentials from the environment (or injected ``StravaCredentials``);
- refreshes an expired access token automatically via the refresh token;
- raises a typed :class:`PermissionDeniedError` instead of prompting when
  credentials are missing or cannot be refreshed.

``stravalib`` is imported lazily so the platform stays importable without it; if
it is not installed, a typed error is returned. The network seam
(``client_factory``) and the fetch seam (``fetch``) are injectable so the import
logic is testable without network access.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from utils.apps.exercise.backend.services import history as history_service
from utils.apps.exercise.shared.errors import (
    ExerciseError,
    PermissionDeniedError,
    ValidationError,
)
from utils.apps.exercise.shared.schemas import HistoryDTO

VALID_PERIODS = ("week", "all")


@dataclass(frozen=True)
class StravaCredentials:
    client_id: str
    client_secret: str
    access_token: str | None = None
    refresh_token: str | None = None


def _load_credentials() -> StravaCredentials:
    client_id = os.environ.get("STRAVA_CLIENT")
    client_secret = os.environ.get("STRAVA_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise PermissionDeniedError(
            "Strava is not configured: set STRAVA_CLIENT and STRAVA_CLIENT_SECRET",
            details={"missing": "client_credentials"},
        )
    access_token = os.environ.get("STRAVA_ACCESS_TOKEN")
    refresh_token = os.environ.get("STRAVA_REFRESH_TOKEN")
    if not access_token and not refresh_token:
        raise PermissionDeniedError(
            "Strava has no usable token: set STRAVA_ACCESS_TOKEN or STRAVA_REFRESH_TOKEN",
            details={"missing": "tokens"},
        )
    return StravaCredentials(
        client_id=client_id,
        client_secret=client_secret,
        access_token=access_token,
        refresh_token=refresh_token,
    )


def _build_client():
    try:
        from stravalib import Client  # lazy: optional dependency
    except ModuleNotFoundError as exc:
        raise ExerciseError(
            "Strava support is not installed (missing 'stravalib')",
            details={"dependency": "stravalib"},
        ) from exc
    return Client()


def _persist_tokens(access_token: str, refresh_token: str) -> None:
    """Persist refreshed tokens to MANGO_STRAVA_TOKEN_FILE when configured.

    Strava rotates refresh tokens on each refresh; persisting keeps the next sync
    working. When the path is unset, tokens are used only for the current call.
    """
    path = os.environ.get("MANGO_STRAVA_TOKEN_FILE")
    if not path:
        return
    import json

    with open(path, "w", encoding="utf-8") as handle:
        json.dump({"access_token": access_token, "refresh_token": refresh_token}, handle)


def fetch_strava_activities(
    period: str = "week",
    *,
    credentials: StravaCredentials | None = None,
    client_factory: Callable[[], Any] | None = None,
) -> list[dict[str, Any]]:
    """Fetch and normalize Run/Walk activities. Non-interactive; never prompts."""
    if period not in VALID_PERIODS:
        raise ValidationError(
            f"period must be one of {VALID_PERIODS}", details={"period": period}
        )

    creds = credentials or _load_credentials()
    client = (client_factory or _build_client)()

    os.environ.setdefault("SILENCE_TOKEN_WARNINGS", "true")

    try:
        from stravalib.exc import AccessUnauthorized
    except ModuleNotFoundError:  # pragma: no cover - only when stravalib absent
        AccessUnauthorized = Exception  # type: ignore[assignment]

    authorized = False
    if creds.access_token:
        client.access_token = creds.access_token
        try:
            client.get_athlete()
            authorized = True
        except AccessUnauthorized:
            authorized = False

    if not authorized:
        if not creds.refresh_token:
            raise PermissionDeniedError(
                "Strava access token is invalid and no refresh token is available",
                details={"action": "reauthorize"},
            )
        try:
            refreshed = client.refresh_access_token(
                client_id=creds.client_id,
                client_secret=creds.client_secret,
                refresh_token=creds.refresh_token,
            )
        except Exception as exc:  # stravalib raises various auth errors
            raise PermissionDeniedError(
                f"Strava token refresh failed: {exc}", details={"action": "reauthorize"}
            ) from exc
        client.access_token = refreshed["access_token"]
        _persist_tokens(refreshed["access_token"], refreshed["refresh_token"])

    return _collect_run_walk(client, period)


def _collect_run_walk(client, period: str) -> list[dict[str, Any]]:
    from datetime import datetime, timedelta

    try:
        if period == "all":
            activities = client.get_activities()
        else:
            activities = client.get_activities(after=datetime.now() - timedelta(days=7))
    except Exception as exc:
        raise ExerciseError(
            f"Failed to fetch Strava activities: {exc}", details={}
        ) from exc

    results: list[dict[str, Any]] = []
    for activity in activities:
        activity_type = str(getattr(activity.type, "root", activity.type))
        if activity_type not in ("Run", "Walk"):
            continue
        miles = (float(activity.distance) / 1000) * 0.621371
        local_dt = activity.start_date_local
        moving = activity.moving_time
        seconds = int(moving.total_seconds() if hasattr(moving, "total_seconds") else moving)
        results.append(
            {
                "id": str(activity.id),
                "Name": activity.name,
                "Type": activity_type,
                "date": local_dt.strftime("%Y-%m-%d") if local_dt else None,
                "start_time": local_dt.strftime("%H:%M:%S") if local_dt else None,
                "Distance (miles)": float(f"{miles:.2f}"),
                "Moving Time (s)": seconds,
            }
        )
    return results


def _activity_to_log(activity: dict[str, Any]) -> HistoryDTO:
    return HistoryDTO(
        id=f"strava_{activity['id']}",
        workout_id="run" if activity["Type"] == "Run" else "walk",
        date=activity["date"],
        start_time=activity.get("start_time"),
        duration=int(activity["Moving Time (s)"]),
        volume=float(activity["Distance (miles)"]),
        notes=activity.get("Name"),
        exercises=[
            {
                "name": f"Strava {activity['Type']}",
                "distance": activity["Distance (miles)"],
                "unit": "mi",
                "sets": 1,
                "reps": 1,
                "weight": 0,
            }
        ],
    )


def sync_strava(
    period: str = "week",
    *,
    fetch: Callable[[str], list[dict[str, Any]]] | None = None,
) -> dict[str, int]:
    """Import Strava Run/Walk activities into history, skipping duplicates.

    Returns a summary: ``{"fetched", "imported", "skipped"}``.
    """
    if period not in VALID_PERIODS:
        raise ValidationError(
            f"period must be one of {VALID_PERIODS}", details={"period": period}
        )

    activities = (fetch or fetch_strava_activities)(period)
    seen = history_service.existing_ids()

    imported = 0
    skipped = 0
    for activity in activities:
        if f"strava_{activity['id']}" in seen:
            skipped += 1
            continue
        history_service.add_log(_activity_to_log(activity))
        imported += 1

    return {"fetched": len(activities), "imported": imported, "skipped": skipped}
