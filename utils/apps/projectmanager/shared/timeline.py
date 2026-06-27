"""Pure timeline/Gantt helpers ported from the legacy ProjectManager app.

These operate on plain timeline-item dicts (``{id, name, type, start_date,
end_date, status, category_color, project_id, ...}``) and carry no model or
Django dependency. The item dicts themselves are built in
``backend/services/timeline.py`` from the ORM rows.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple


def parse_date(date_val: Optional[str]) -> Optional[datetime]:
    """Parse an ISO date string into a naive-UTC datetime for comparison."""
    if not date_val:
        return None
    try:
        if date_val.endswith("Z"):
            dt = datetime.fromisoformat(date_val.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        dt = datetime.fromisoformat(date_val)
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return None


def calculate_date_range(
    items: List[Dict],
    padding_days: int = 7,
    explicit_range: Optional[Tuple[datetime, datetime]] = None,
) -> Tuple[datetime, datetime]:
    """Determine the (min, max) datetime bounds for a timeline view."""
    if explicit_range:
        return explicit_range

    if not items:
        now = datetime.utcnow()
        return (now - timedelta(days=30), now + timedelta(days=30))

    min_date = None
    max_date = None

    for item in items:
        start = item.get("start_date")
        start = parse_date(start) if isinstance(start, str) else start
        end = item.get("end_date")
        end = parse_date(end) if isinstance(end, str) else end

        if start:
            if min_date is None or start < min_date:
                min_date = start
        if end:
            if max_date is None or end > max_date:
                max_date = end
        elif start:
            if max_date is None or start > max_date:
                max_date = start

    now = datetime.utcnow()
    if min_date is None:
        min_date = now - timedelta(days=30)
    if max_date is None:
        max_date = now

    return (min_date - timedelta(days=padding_days), max_date + timedelta(days=padding_days))


def filter_timeline_items(
    items: List[Dict],
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    status: Optional[List[str]] = None,
    project_id: Optional[int] = None,
    item_type: Optional[str] = None,
) -> List[Dict]:
    """Filter timeline items by type, status, owning project, and date window."""
    filtered = items

    if item_type:
        filtered = [i for i in filtered if i.get("type") == item_type]

    if status:
        filtered = [i for i in filtered if i.get("status") in status]

    if project_id is not None:
        filtered = [
            i
            for i in filtered
            if i.get("project_id") == project_id
            or (i.get("type") == "project" and i.get("id") == project_id)
        ]

    if date_start:
        def ends_after(item: Dict) -> bool:
            end = item.get("end_date")
            if end is None:
                return True
            if isinstance(end, str):
                end = parse_date(end)
            if isinstance(end, datetime) and end.tzinfo is not None:
                end = end.astimezone(timezone.utc).replace(tzinfo=None)
            return end >= date_start

        filtered = [i for i in filtered if ends_after(i)]

    if date_end:
        def starts_before(item: Dict) -> bool:
            start = item.get("start_date")
            if start is None:
                return True
            if isinstance(start, str):
                start = parse_date(start)
            if isinstance(start, datetime) and start.tzinfo is not None:
                start = start.astimezone(timezone.utc).replace(tzinfo=None)
            return start <= date_end

        filtered = [i for i in filtered if starts_before(i)]

    return filtered


def prepare_gantt_data(items: List[Dict], date_range: Tuple[datetime, datetime]) -> Dict:
    """Convert timeline items into the full Gantt payload with a date axis."""
    min_date, max_date = date_range
    total_days = (max_date - min_date).days

    if total_days <= 14:
        zoom_level = "day"
        step_days = 1
    elif total_days <= 90:
        zoom_level = "week"
        step_days = 7
    else:
        zoom_level = "month"
        step_days = 30

    date_axis = []
    current = min_date
    position = 0
    while current <= max_date:
        label = current.strftime("%b %Y") if zoom_level == "month" else current.strftime("%b %d")
        date_axis.append({"date": current.isoformat(), "label": label, "position": position})
        current += timedelta(days=step_days)
        position += 1

    return {
        "items": items,
        "dateAxis": date_axis,
        "minDate": min_date.isoformat(),
        "maxDate": max_date.isoformat(),
        "zoomLevel": zoom_level,
    }
