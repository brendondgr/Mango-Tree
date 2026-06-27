"""Lightweight DTO/normalization helpers shared by the API and agent layers.

Schedules and their events are intentionally kept as plain dicts so the dual
event format (legacy flat ``day/start/end`` and the newer ``timestamps[]``) and
any optional fields (``overwriteable``, ``sub``) survive a round-trip unchanged.
Only the two *fixed-shape* inputs — direct events and calendar entries — are
normalized here, mirroring the original app's field whitelist exactly.
"""

from __future__ import annotations

from typing import Any


def normalize_direct_event(event_data: dict[str, Any]) -> dict[str, Any]:
    """Project an input dict onto the stored direct-event shape.

    Matches the original app: ``type`` defaults to ``"other"`` and ``sub`` is
    carried over only when the key is present (preserving empty-string subs).
    Assumes the input has already been validated.
    """
    event: dict[str, Any] = {
        "date": event_data["date"],
        "title": event_data["title"],
        "type": event_data.get("type", "other"),
        "start": event_data["start"],
        "end": event_data["end"],
    }
    if "sub" in event_data:
        event["sub"] = event_data["sub"]
    return event


def normalize_calendar_entry(
    start_date: str, end_date: str, schedule_filename: str
) -> dict[str, Any]:
    """The stored shape of a schedule-to-date mapping entry."""
    return {
        "start_date": start_date,
        "end_date": end_date,
        "schedule_filename": schedule_filename,
    }


def default_calendar() -> dict[str, Any]:
    """An empty calendar configuration."""
    return {"entries": [], "direct_events": []}
