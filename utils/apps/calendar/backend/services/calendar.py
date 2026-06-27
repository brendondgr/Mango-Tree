"""Calendar service: config, schedule-to-date entries, direct events, and the
merged day/week/range views.

State lives in ``data/calendar/calendar.json`` (``entries`` + ``direct_events``).
This module ports the original ``calendar_io`` plus the merge assembly and the
three agent-flavored helpers (free slots, upcoming, delete-by-title) that used to
live inline in the Flask routes. It calls the schedule service to resolve the
template for a date; both surfaces (API + agent tools) call back into here.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any

from utils.apps.calendar.shared import colors, date_utils, event_merger, schemas, validators
from utils.apps.calendar.shared.errors import ConflictError, NotFoundError, ValidationError

from . import schedules, store

# Distinct colors for differentiating schedules in the week/range grid.
SCHEDULE_COLORS = [
    {"bg": "#818cf8", "text": "#1e1b4b", "border": "#6366f1"},  # Indigo
    {"bg": "#34d399", "text": "#064e3b", "border": "#10b981"},  # Emerald
    {"bg": "#fb923c", "text": "#431407", "border": "#f97316"},  # Orange
    {"bg": "#f472b6", "text": "#500724", "border": "#ec4899"},  # Pink
    {"bg": "#60a5fa", "text": "#1e3a5f", "border": "#3b82f6"},  # Blue
    {"bg": "#a78bfa", "text": "#2e1065", "border": "#8b5cf6"},  # Violet
    {"bg": "#fbbf24", "text": "#451a03", "border": "#f59e0b"},  # Amber
    {"bg": "#2dd4bf", "text": "#134e4a", "border": "#14b8a6"},  # Teal
]


def get_schedule_color(schedule_filename: str | None) -> dict[str, str] | None:
    """A stable color for a schedule, keyed deterministically by its filename.

    Uses a stable digest (not the process-randomized ``hash()`` the original used)
    so a schedule keeps the same color across restarts.
    """
    if not schedule_filename:
        return None
    digest = int(hashlib.sha1(schedule_filename.encode("utf-8")).hexdigest(), 16)
    return SCHEDULE_COLORS[digest % len(SCHEDULE_COLORS)]


def _schedule_display_name(schedule_filename: str | None, cache: dict[str, str | None]) -> str | None:
    """Display name from a schedule file, with a per-call cache; falls back to the
    filename without extension."""
    if not schedule_filename:
        return None
    if schedule_filename in cache:
        return cache[schedule_filename]
    try:
        data = schedules.load_schedule(schedule_filename)
        name = data.get("name", schedule_filename.replace(".json", ""))
    except Exception:
        name = schedule_filename.replace(".json", "")
    cache[schedule_filename] = name
    return name


# --- Config read/write -------------------------------------------------------

def load_calendar() -> dict[str, Any]:
    """Load ``calendar.json`` (creating an empty default if missing)."""
    path = store.calendar_file()
    if not path.exists():
        default = schemas.default_calendar()
        store.write_json_atomic(path, default)
        return default
    return store.read_json(path)


def save_calendar(config: dict[str, Any]) -> None:
    store.write_json_atomic(store.calendar_file(), config)


def get_schedule_for_date(date: str) -> str | None:
    """The schedule filename mapped to a date, or ``None``."""
    config = load_calendar()
    for entry in config.get("entries", []):
        start = entry.get("start_date")
        end = entry.get("end_date")
        if start and end and date_utils.date_in_range(date, start, end):
            return entry.get("schedule_filename")
    return None


def get_direct_events_for_date(date: str) -> list[dict[str, Any]]:
    """Direct events on a date, each tagged with its ``_direct_index``."""
    config = load_calendar()
    events: list[dict[str, Any]] = []
    for i, event in enumerate(config.get("direct_events", [])):
        if event.get("date") == date:
            event_copy = event.copy()
            event_copy["_direct_index"] = i
            events.append(event_copy)
    return events


# --- Merged views ------------------------------------------------------------

def _merge_day(date: str, all_colors: dict[str, Any]) -> tuple[str | None, list[dict[str, Any]]]:
    """Merge schedule + direct events for one date, accumulating type colors."""
    schedule_filename = get_schedule_for_date(date)
    schedule_events: list[dict[str, Any]] = []

    if schedule_filename:
        schedule_data = schedules.load_schedule(schedule_filename)
        all_events = schedule_data.get("events", [])
        day_index = date_utils.get_day_of_week(date)
        schedule_events = event_merger.get_events_for_day(all_events, day_index)

        unique_types = list({e.get("type", "other") for e in all_events})
        color_mappings = schedule_data.get("color_mappings", {})
        all_colors.update(colors.generate_color_palette(unique_types, color_mappings))

    direct_events = get_direct_events_for_date(date)
    merged = event_merger.merge_events(schedule_events, direct_events, date)

    for event in direct_events:
        event_type = event.get("type", "other")
        if event_type not in all_colors:
            all_colors.update(colors.generate_color_palette([event_type]))

    return schedule_filename, merged


def day_view(date: str) -> dict[str, Any]:
    """Merged schedule + direct events for a single date."""
    all_colors: dict[str, Any] = {}
    schedule_filename, merged = _merge_day(date, all_colors)
    return {
        "date": date,
        "schedule_filename": schedule_filename,
        "events": merged,
        "colors": all_colors,
    }


def _multi_day_view(dates: list[str]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build the per-day map + accumulated colors for a list of dates."""
    days: dict[str, Any] = {}
    all_colors: dict[str, Any] = {}
    name_cache: dict[str, str | None] = {}
    for day_date in dates:
        schedule_filename, merged = _merge_day(day_date, all_colors)
        days[day_date] = {
            "schedule_filename": schedule_filename,
            "schedule_name": _schedule_display_name(schedule_filename, name_cache),
            "schedule_color": get_schedule_color(schedule_filename),
            "events": merged,
        }
    return days, all_colors


def week_view(date: str | None = None) -> dict[str, Any]:
    """Merged events for the week containing ``date`` (default: current week)."""
    date = date or date_utils.get_today()
    week_start, week_end = date_utils.get_week_range(date)
    dates = date_utils.get_dates_in_range(week_start, week_end)
    days, all_colors = _multi_day_view(dates)
    return {
        "week_start": week_start,
        "week_end": week_end,
        "days": days,
        "colors": all_colors,
    }


def range_view(start_date: str, end_date: str) -> dict[str, Any]:
    """Merged events across an inclusive date range."""
    if not start_date or not end_date:
        raise ValidationError("start and end parameters required")
    dates = date_utils.get_dates_in_range(start_date, end_date)
    days, all_colors = _multi_day_view(dates)
    return {
        "start_date": start_date,
        "end_date": end_date,
        "days": days,
        "colors": all_colors,
    }


# --- Schedule-to-date entries ------------------------------------------------

def _validate_entry(
    start_date: str, end_date: str, schedule_filename: str, exclude_index: int | None = None
) -> str:
    """Validate an entry; return the sanitized schedule filename.

    Raises ValidationError for bad dates / ordering / missing schedule, and
    ConflictError when the range overlaps an existing entry.
    """
    try:
        start = date_utils.parse_date(start_date)
        end = date_utils.parse_date(end_date)
    except ValueError as exc:
        raise ValidationError("Invalid date format. Use YYYY-MM-DD.") from exc

    if start > end:
        raise ValidationError("Start date must be before or equal to end date.")

    safe_name = validators.sanitize_filename(schedule_filename)
    if not (store.schedules_dir() / safe_name).exists():
        raise ValidationError(f"Schedule file '{schedule_filename}' not found.")

    config = load_calendar()
    for i, entry in enumerate(config.get("entries", [])):
        if exclude_index is not None and i == exclude_index:
            continue
        e_start = date_utils.parse_date(entry.get("start_date"))
        e_end = date_utils.parse_date(entry.get("end_date"))
        if start <= e_end and e_start <= end:
            raise ConflictError(
                f"Date range overlaps with existing entry "
                f"({entry.get('start_date')} to {entry.get('end_date')})."
            )

    return safe_name


def add_calendar_entry(start_date: str, end_date: str, schedule_filename: str) -> int:
    """Add a schedule-to-date mapping. Returns the new entry index."""
    safe_name = _validate_entry(start_date, end_date, schedule_filename)
    config = load_calendar()
    config.setdefault("entries", []).append(
        schemas.normalize_calendar_entry(start_date, end_date, safe_name)
    )
    save_calendar(config)
    return len(config["entries"]) - 1


def update_calendar_entry(
    index: int, start_date: str, end_date: str, schedule_filename: str
) -> None:
    config = load_calendar()
    entries = config.get("entries", [])
    if index < 0 or index >= len(entries):
        raise NotFoundError(f"Entry index {index} out of range.")
    safe_name = _validate_entry(start_date, end_date, schedule_filename, exclude_index=index)
    entries[index] = schemas.normalize_calendar_entry(start_date, end_date, safe_name)
    save_calendar(config)


def delete_calendar_entry(index: int) -> None:
    config = load_calendar()
    entries = config.get("entries", [])
    if index < 0 or index >= len(entries):
        raise NotFoundError(f"Entry index {index} out of range.")
    entries.pop(index)
    save_calendar(config)


def remove_mappings_for_schedule(schedule_filename: str) -> int:
    """Remove every entry referencing a schedule. Returns the count removed."""
    config = load_calendar()
    original = config.get("entries", [])
    kept = [e for e in original if e.get("schedule_filename") != schedule_filename]
    removed = len(original) - len(kept)
    if removed > 0:
        config["entries"] = kept
        save_calendar(config)
    return removed


# --- Direct events -----------------------------------------------------------

def _validate_direct_event(event_data: dict[str, Any]) -> None:
    for field in ("date", "title", "start", "end"):
        if field not in event_data:
            raise ValidationError(f"Missing required field: {field}")
    try:
        date_utils.parse_date(event_data["date"])
    except ValueError as exc:
        raise ValidationError("Invalid date format. Use YYYY-MM-DD.") from exc
    try:
        start_mins = date_utils.parse_time(event_data["start"])
        end_mins = date_utils.parse_time(event_data["end"])
    except (ValueError, IndexError) as exc:
        raise ValidationError("Invalid time format. Use HH:MM.") from exc
    if start_mins >= end_mins:
        raise ValidationError("Start time must be before end time.")


def add_direct_event(event_data: dict[str, Any]) -> int:
    """Add a one-off direct event. Returns the new event index."""
    _validate_direct_event(event_data)
    config = load_calendar()
    config.setdefault("direct_events", []).append(schemas.normalize_direct_event(event_data))
    save_calendar(config)
    return len(config["direct_events"]) - 1


def update_direct_event(index: int, event_data: dict[str, Any]) -> None:
    config = load_calendar()
    events = config.get("direct_events", [])
    if index < 0 or index >= len(events):
        raise NotFoundError(f"Event index {index} out of range.")
    _validate_direct_event(event_data)
    events[index] = schemas.normalize_direct_event(event_data)
    save_calendar(config)


def delete_direct_event(index: int) -> None:
    config = load_calendar()
    events = config.get("direct_events", [])
    if index < 0 or index >= len(events):
        raise NotFoundError(f"Event index {index} out of range.")
    events.pop(index)
    save_calendar(config)


# --- Agent-flavored helpers --------------------------------------------------

def free_slots(
    date: str,
    min_duration_minutes: int = 30,
    start_after: str = "08:00",
    end_before: str = "22:00",
) -> dict[str, Any]:
    """Find free gaps on a date within a window, merging busy blocks first."""
    _, merged_events = _merge_day(date, {})

    window_start = date_utils.parse_time(start_after)
    window_end = date_utils.parse_time(end_before)

    busy: list[tuple[int, int]] = []
    for event in merged_events:
        s = date_utils.parse_time(event.get("start", "00:00"))
        e = date_utils.parse_time(event.get("end", "00:00"))
        s = max(s, window_start)
        e = min(e, window_end)
        if s < e:
            busy.append((s, e))

    busy.sort()
    merged_busy: list[tuple[int, int]] = []
    for s, e in busy:
        if merged_busy and s <= merged_busy[-1][1]:
            merged_busy[-1] = (merged_busy[-1][0], max(merged_busy[-1][1], e))
        else:
            merged_busy.append((s, e))

    free: list[dict[str, Any]] = []
    cursor = window_start
    for s, e in merged_busy:
        if s > cursor:
            duration = s - cursor
            if duration >= min_duration_minutes:
                free.append({
                    "start": date_utils.format_time(cursor),
                    "end": date_utils.format_time(s),
                    "duration_minutes": duration,
                })
        cursor = max(cursor, e)

    if cursor < window_end:
        duration = window_end - cursor
        if duration >= min_duration_minutes:
            free.append({
                "start": date_utils.format_time(cursor),
                "end": date_utils.format_time(window_end),
                "duration_minutes": duration,
            })

    return {
        "date": date,
        "start_after": start_after,
        "end_before": end_before,
        "min_duration_minutes": min_duration_minutes,
        "free_slots": free,
    }


def upcoming(days_ahead: int = 14, type_filter: str | None = None) -> dict[str, Any]:
    """Upcoming direct events within ``days_ahead`` days from today."""
    today = date_utils.get_today()
    end_date = date_utils.format_date(date_utils.parse_date(today) + timedelta(days=days_ahead))

    config = load_calendar()
    found: list[dict[str, Any]] = []
    for i, event in enumerate(config.get("direct_events", [])):
        event_date = event.get("date", "")
        if not event_date:
            continue
        if not date_utils.date_in_range(event_date, today, end_date):
            continue
        if type_filter and event.get("type") != type_filter:
            continue
        event_copy = event.copy()
        event_copy["_direct_index"] = i
        found.append(event_copy)

    found.sort(key=lambda ev: (ev.get("date", ""), ev.get("start", "")))

    return {
        "today": today,
        "days_ahead": days_ahead,
        "end_date": end_date,
        "type_filter": type_filter,
        "events": found,
        "count": len(found),
    }


def delete_event_by_title(date: str, title: str) -> dict[str, Any]:
    """Delete a direct event by date + partial title match.

    Raises NotFoundError when nothing matches and ConflictError when the match is
    ambiguous (more than one event). On a single match, deletes and returns it.
    """
    if not date or not title:
        raise ValidationError("date and title are required")

    config = load_calendar()
    title_lower = title.lower()

    matches = [
        (i, event)
        for i, event in enumerate(config.get("direct_events", []))
        if event.get("date") == date and title_lower in event.get("title", "").lower()
    ]

    if not matches:
        raise NotFoundError("Event not found")

    if len(matches) > 1:
        titles = [m[1].get("title") for m in matches]
        raise ConflictError(
            f"Ambiguous match: found {len(matches)} events matching '{title}' on {date}. "
            "Please use a more specific title.",
            details={"matches": titles},
        )

    index, deleted_event = matches[0]
    delete_direct_event(index)
    return {"deleted_event": deleted_event, "index": index}
