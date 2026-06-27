"""
Date utility functions for calendar operations.
"""
from datetime import datetime, timedelta
from typing import Tuple, Optional

DATE_FORMAT = "%Y-%m-%d"
TIME_FORMAT = "%H:%M"


def parse_date(date_string: str) -> datetime:
    """Parse YYYY-MM-DD format to datetime object."""
    return datetime.strptime(date_string, DATE_FORMAT)


def format_date(dt: datetime) -> str:
    """Format datetime object to YYYY-MM-DD string."""
    return dt.strftime(DATE_FORMAT)


def get_today() -> str:
    """Get today's date in YYYY-MM-DD format."""
    return format_date(datetime.now())


def get_current_week_start() -> str:
    """Get Monday of current week (YYYY-MM-DD)."""
    today = datetime.now()
    # weekday() returns 0 for Monday
    monday = today - timedelta(days=today.weekday())
    return format_date(monday)


def get_current_week_end() -> str:
    """Get Sunday of current week (YYYY-MM-DD)."""
    today = datetime.now()
    # Sunday is 6 days after Monday
    sunday = today + timedelta(days=6 - today.weekday())
    return format_date(sunday)


def get_week_range(date: str) -> Tuple[str, str]:
    """
    Get start/end dates for week containing date (Monday-Sunday).

    Args:
        date: Date string in YYYY-MM-DD format

    Returns:
        Tuple of (monday, sunday) date strings
    """
    dt = parse_date(date)
    monday = dt - timedelta(days=dt.weekday())
    sunday = monday + timedelta(days=6)
    return format_date(monday), format_date(sunday)


def get_month_range(date: str) -> Tuple[str, str]:
    """
    Get start/end dates for month containing date.

    Args:
        date: Date string in YYYY-MM-DD format

    Returns:
        Tuple of (first_day, last_day) date strings
    """
    dt = parse_date(date)
    first_day = dt.replace(day=1)

    # Get last day by going to next month and subtracting a day
    if dt.month == 12:
        next_month = dt.replace(year=dt.year + 1, month=1, day=1)
    else:
        next_month = dt.replace(month=dt.month + 1, day=1)
    last_day = next_month - timedelta(days=1)

    return format_date(first_day), format_date(last_day)


def get_year_range(date: str) -> Tuple[str, str]:
    """
    Get start/end dates for year containing date.

    Args:
        date: Date string in YYYY-MM-DD format

    Returns:
        Tuple of (jan_1, dec_31) date strings
    """
    dt = parse_date(date)
    first_day = dt.replace(month=1, day=1)
    last_day = dt.replace(month=12, day=31)
    return format_date(first_day), format_date(last_day)


def date_in_range(date: str, start_date: str, end_date: str) -> bool:
    """
    Check if date falls within range (inclusive).

    Args:
        date: Date to check (YYYY-MM-DD)
        start_date: Range start (YYYY-MM-DD)
        end_date: Range end (YYYY-MM-DD)

    Returns:
        True if date is within range
    """
    dt = parse_date(date)
    start = parse_date(start_date)
    end = parse_date(end_date)
    return start <= dt <= end


def get_dates_in_range(start_date: str, end_date: str) -> list:
    """
    Get all dates in a range (inclusive).

    Args:
        start_date: Range start (YYYY-MM-DD)
        end_date: Range end (YYYY-MM-DD)

    Returns:
        List of date strings
    """
    start = parse_date(start_date)
    end = parse_date(end_date)
    dates = []
    current = start
    while current <= end:
        dates.append(format_date(current))
        current += timedelta(days=1)
    return dates


def format_date_for_display(date: str, include_year: bool = True) -> str:
    """
    Format date for UI display.

    Args:
        date: Date string (YYYY-MM-DD)
        include_year: Whether to include year

    Returns:
        Formatted string like "January 5, 2026" or "January 5"
    """
    dt = parse_date(date)
    if include_year:
        return dt.strftime("%B %d, %Y")
    return dt.strftime("%B %d")


def get_day_of_week(date: str) -> int:
    """
    Get day of week index (0=Monday, 6=Sunday).

    Args:
        date: Date string (YYYY-MM-DD)

    Returns:
        Day index (0-6)
    """
    return parse_date(date).weekday()


def get_day_name(date: str) -> str:
    """
    Get day name for a date.

    Args:
        date: Date string (YYYY-MM-DD)

    Returns:
        Day name ("Monday", "Tuesday", etc.)
    """
    return parse_date(date).strftime("%A")


# Time utilities

def parse_time(time_string: str) -> int:
    """
    Parse HH:MM format to minutes since midnight.

    Args:
        time_string: Time in HH:MM format

    Returns:
        Minutes since midnight
    """
    parts = time_string.split(':')
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def format_time(minutes: int) -> str:
    """
    Format minutes since midnight to HH:MM.

    Args:
        minutes: Minutes since midnight

    Returns:
        Time string in HH:MM format
    """
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def time_overlaps(start1: str, end1: str, start2: str, end2: str) -> bool:
    """
    Check if two time ranges overlap.

    Args:
        start1, end1: First time range (HH:MM)
        start2, end2: Second time range (HH:MM)

    Returns:
        True if ranges overlap
    """
    s1, e1 = parse_time(start1), parse_time(end1)
    s2, e2 = parse_time(start2), parse_time(end2)
    # Ranges overlap if one starts before the other ends
    return s1 < e2 and s2 < e1


def time_contains(outer_start: str, outer_end: str,
                  inner_start: str, inner_end: str) -> bool:
    """
    Check if first time range fully contains second.

    Args:
        outer_start, outer_end: Outer time range (HH:MM)
        inner_start, inner_end: Inner time range (HH:MM)

    Returns:
        True if outer range fully contains inner
    """
    os, oe = parse_time(outer_start), parse_time(outer_end)
    ins, ine = parse_time(inner_start), parse_time(inner_end)
    return os <= ins and ine <= oe
