"""Schedule service: CRUD over reusable weekly schedule templates.

Schedules live as ``data/calendar/schedules/<name>.json``. This module is the
single source of truth for loading, validating, expanding, and mutating them; the
DRF views and agent tools call it and never touch files directly. Behavior mirrors
the original Flask app's ``schedule_io`` plus the per-schedule view assembly that
used to live inline in the routes (colors + stats + category breakdowns).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from utils.apps.calendar.shared import colors, stats, validators
from utils.apps.calendar.shared.errors import NotFoundError, ValidationError

from . import store


# --- Paths -------------------------------------------------------------------

def _schedule_path(filename: str) -> tuple[str, Path]:
    """Return ``(safe_name, path)`` for a schedule file (path-traversal safe)."""
    safe_name = validators.sanitize_filename(filename)
    return safe_name, store.schedules_dir() / safe_name


# --- Event expansion (pure, mirrors the original schedule_io) ----------------

def expand_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Expand events into one instance per (day, start, end).

    Supports both the legacy flat ``day/start/end`` and the newer
    ``timestamps: [{day, start, end}]`` structures. Each expanded event gains an
    ``_original_idx`` pointing back to its index in the raw list.
    """
    expanded: list[dict[str, Any]] = []
    for original_idx, event in enumerate(events):
        if "timestamps" in event:
            base_event = event.copy()
            del base_event["timestamps"]

            for ts in event["timestamps"]:
                days = ts.get("day")
                start = ts.get("start")
                end = ts.get("end")

                day_list = days if isinstance(days, list) else [days]

                for day in day_list:
                    new_event = base_event.copy()
                    new_event["day"] = day
                    new_event["start"] = start
                    new_event["end"] = end
                    new_event["_original_idx"] = original_idx
                    expanded.append(new_event)

        elif "day" in event:
            day_value = event.get("day")

            if isinstance(day_value, list):
                for day in day_value:
                    event_copy = event.copy()
                    event_copy["day"] = day
                    event_copy["_original_idx"] = original_idx
                    expanded.append(event_copy)
            else:
                event_copy = event.copy()
                event_copy["_original_idx"] = original_idx
                expanded.append(event_copy)

    return expanded


def _generate_default_color_mappings(events: list[dict[str, Any]]) -> dict[str, str]:
    """Assign a palette color to each unique event type (alphabetical, cyclic)."""
    unique_types = {event.get("type", "other") for event in events}
    sorted_types = sorted(unique_types)
    mappings: dict[str, str] = {}
    for idx, event_type in enumerate(sorted_types):
        color_index = idx % len(colors.PREDEFINED_COLORS)
        mappings[event_type] = colors.PREDEFINED_COLORS[color_index]["name"]
    return mappings


# --- Read --------------------------------------------------------------------

def list_schedules() -> list[str]:
    """All available schedule filenames."""
    directory = store.schedules_dir()
    if not directory.exists():
        return []
    return [f.name for f in directory.iterdir() if f.suffix == ".json"]


def load_schedule(filename: str) -> dict[str, Any]:
    """Load a schedule, auto-migrating missing ``color_mappings`` and expanding events.

    Side effect preserved from the original app: when ``color_mappings`` is
    absent it is generated and persisted back to disk before the events are
    expanded for the caller.
    """
    safe_name, path = _schedule_path(filename)
    if not path.exists():
        raise NotFoundError(f"Schedule '{safe_name}' not found")

    data = store.read_json(path)

    migrated = False
    if "color_mappings" not in data and "events" in data:
        data["color_mappings"] = _generate_default_color_mappings(data["events"])
        migrated = True

    valid, msg = validators.validate_schedule_structure(data)
    if not valid:
        raise ValidationError(f"Invalid schedule data: {msg}")

    if migrated:
        store.write_json_atomic(path, data)

    if "events" in data:
        data["events"] = expand_events(data["events"])

    return data


def get_schedule_detail(filename: str) -> dict[str, Any]:
    """Load a schedule together with its colors, stats, and per-category breakdowns.

    This is the assembly the original ``GET /api/schedules/<file>`` route built
    inline; it is the read shape the editor UI consumes.
    """
    data = load_schedule(filename)
    events = data.get("events", [])

    unique_types = list({e.get("type", "other") for e in events})
    color_mappings = data.get("color_mappings", {})
    color_scheme = colors.generate_color_palette(unique_types, color_mappings)

    schedule_stats = stats.calculate_stats(events)

    breakdowns: dict[str, Any] = {}
    for t in unique_types:
        breakdowns[t] = stats.get_category_breakdown(events, t)

    return {
        "schedule": data,
        "colors": color_scheme,
        "stats": schedule_stats,
        "breakdowns": breakdowns,
    }


def load_instructions() -> str:
    """The LLM prompt describing the schedule JSON schema."""
    path = store.instructions_file()
    if not path.exists():
        return "Instructions file not found."
    return path.read_text(encoding="utf-8")


def predefined_colors() -> list[dict[str, Any]]:
    """The 16-color palette for the color-picker UI."""
    return colors.PREDEFINED_COLORS


# --- Write -------------------------------------------------------------------

def _load_raw_schedule(filename: str) -> tuple[dict[str, Any], Path]:
    """Load a schedule without expansion (for in-place modifications)."""
    safe_name, path = _schedule_path(filename)
    if not path.exists():
        raise NotFoundError(f"Schedule '{safe_name}' not found")
    return store.read_json(path), path


def save_schedule(filename: str, data: dict[str, Any]) -> str:
    """Validate and persist a schedule. Returns the sanitized filename."""
    valid, msg = validators.validate_schedule_structure(data)
    if not valid:
        raise ValidationError(f"Invalid schedule data: {msg}")

    safe_name, path = _schedule_path(filename)
    store.write_json_atomic(path, data)
    return safe_name


def update_color_mappings(filename: str, mappings: dict[str, Any]) -> None:
    """Replace a schedule's ``color_mappings`` block."""
    data, path = _load_raw_schedule(filename)
    data["color_mappings"] = mappings
    store.write_json_atomic(path, data)


def add_event(filename: str, event_data: dict[str, Any]) -> int:
    """Append an event to a schedule. Returns the new event's raw index."""
    valid, msg = validators.validate_event(event_data)
    if not valid:
        raise ValidationError(f"Invalid event: {msg}")

    data, path = _load_raw_schedule(filename)
    data.setdefault("events", []).append(event_data)
    store.write_json_atomic(path, data)
    return len(data["events"]) - 1


def update_event(filename: str, index: int, event_data: dict[str, Any]) -> None:
    """Replace the event at ``index``."""
    valid, msg = validators.validate_event(event_data)
    if not valid:
        raise ValidationError(f"Invalid event: {msg}")

    data, path = _load_raw_schedule(filename)
    events = data.get("events", [])
    if index < 0 or index >= len(events):
        raise NotFoundError(f"Event index {index} out of range")

    events[index] = event_data
    store.write_json_atomic(path, data)


def delete_event(filename: str, index: int) -> None:
    """Remove the event at ``index``."""
    data, path = _load_raw_schedule(filename)
    events = data.get("events", [])
    if index < 0 or index >= len(events):
        raise NotFoundError(f"Event index {index} out of range")

    events.pop(index)
    store.write_json_atomic(path, data)


def delete_schedule(filename: str) -> int:
    """Delete a schedule file and cascade-remove any calendar entries mapping it.

    Returns the number of calendar entries removed.
    """
    safe_name, path = _schedule_path(filename)
    if not path.exists():
        raise NotFoundError(f"Schedule '{safe_name}' not found")

    path.unlink()

    # Cascade is a calendar-config concern; import lazily to avoid a cycle.
    from . import calendar as calendar_service

    return calendar_service.remove_mappings_for_schedule(safe_name)
