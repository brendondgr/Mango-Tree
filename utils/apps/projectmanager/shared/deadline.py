"""Deadline calculation utilities for projects and goals.

Ported from the legacy ProjectManager app. Adapted to be timezone-aware: the
Django ORM returns aware ``datetime`` values (``USE_TZ = True``), so every input
is normalised to UTC before arithmetic to avoid naive/aware ``TypeError``s.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalise a datetime (naive assumed UTC, or aware) to aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def calculate_time_remaining(deadline: Optional[datetime]) -> Optional[Dict]:
    """Calculate time remaining until ``deadline``.

    Returns a dict with ``days`` (negative if overdue), ``hours``, ``is_overdue``
    and ``is_approaching`` (within 3 days), or ``None`` when ``deadline`` is None.
    """
    deadline = _as_utc(deadline)
    if deadline is None:
        return None

    delta = deadline - _now()
    total_seconds = delta.total_seconds()
    is_overdue = total_seconds < 0

    abs_delta = abs(delta)
    days = abs_delta.days
    hours = abs_delta.seconds // 3600

    return {
        "days": days if not is_overdue else -days,
        "hours": hours,
        "is_overdue": is_overdue,
        "is_approaching": not is_overdue and delta.days <= 3,
    }


def format_time_remaining(deadline: Optional[datetime]) -> Optional[str]:
    """Format time remaining as a human-readable string.

    Examples: "Due in 5 days", "Due tomorrow", "Due today", "Overdue by 3 days".
    """
    if deadline is None:
        return None

    remaining = calculate_time_remaining(deadline)
    if remaining is None:
        return None

    if remaining["is_overdue"]:
        days = abs(remaining["days"])
        if days == 0:
            return "Overdue"
        if days == 1:
            return "Overdue by 1 day"
        return f"Overdue by {days} days"

    days = remaining["days"]
    hours = remaining["hours"]

    if days >= 730:
        years = days // 365
        return "Due in 1 year" if years == 1 else f"Due in {years} years"
    if days == 0:
        if hours == 0:
            return "Due now"
        if hours == 1:
            return "Due in 1 hour"
        return f"Due in {hours} hours"
    if days == 1:
        return "Due tomorrow"
    return f"Due in {days} days"


def is_overdue(deadline: Optional[datetime]) -> bool:
    """Check whether ``deadline`` has passed."""
    deadline = _as_utc(deadline)
    if deadline is None:
        return False
    return _now() > deadline


def is_approaching(deadline: Optional[datetime], days: int = 3) -> bool:
    """Check whether ``deadline`` falls within the warning threshold."""
    deadline = _as_utc(deadline)
    if deadline is None:
        return False
    now = _now()
    return now < deadline <= now + timedelta(days=days)


def get_deadline_status(deadline: Optional[datetime]) -> Optional[Dict]:
    """Comprehensive deadline status for serialization, or ``None`` if no deadline.

    Returns ``display``, ``css_class`` (``projectmanager-deadline-*``),
    ``date_formatted``, ``date_short``, ``is_overdue`` and ``is_approaching``.
    """
    deadline = _as_utc(deadline)
    if deadline is None:
        return None

    remaining = calculate_time_remaining(deadline)

    if remaining["is_overdue"]:
        css_class = "projectmanager-deadline-overdue"
    elif remaining["is_approaching"]:
        css_class = "projectmanager-deadline-warning"
    else:
        css_class = "projectmanager-deadline-normal"

    return {
        "display": format_time_remaining(deadline),
        "css_class": css_class,
        "date_formatted": deadline.strftime("%b %d, %Y"),
        "date_short": deadline.strftime("%y-%m-%d"),
        "is_overdue": remaining["is_overdue"],
        "is_approaching": remaining["is_approaching"],
    }
