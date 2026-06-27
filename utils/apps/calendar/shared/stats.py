"""Schedule statistics: duration, overlap, and category breakdown helpers."""

def calculate_duration(start_str, end_str):
    """Calculates hours between two HH:MM strings."""
    h1, m1 = map(int, start_str.split(':'))
    h2, m2 = map(int, end_str.split(':'))
    return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60.0

def parse_time_to_minutes(time_str):
    """Convert HH:MM to minutes since midnight."""
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def time_ranges_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap."""
    return start1 < end2 and end1 > start2

def calculate_effective_duration(event, all_events):
    """
    Calculate the effective duration of an event, accounting for overlaps.
    For overwriteable events, time is reduced when overlapped by non-overwriteable events.
    """
    evt_start = parse_time_to_minutes(event['start'])
    evt_end = parse_time_to_minutes(event['end'])
    evt_day = event.get('day', 0)

    # If event is not overwriteable, return full duration
    if not event.get('overwriteable', False):
        return (evt_end - evt_start) / 60.0

    # Find overlapping non-overwriteable events on the same day
    overlaps = []
    for other in all_events:
        # Skip self and other overwriteable events
        if other is event or other.get('overwriteable', False):
            continue

        # Must be same day
        other_day = other.get('day', 0)
        if other_day != evt_day:
            continue

        other_start = parse_time_to_minutes(other['start'])
        other_end = parse_time_to_minutes(other['end'])

        if time_ranges_overlap(evt_start, evt_end, other_start, other_end):
            overlaps.append((other_start, other_end))

    if not overlaps:
        return (evt_end - evt_start) / 60.0

    # Sort overlaps by start time
    overlaps.sort(key=lambda x: x[0])

    # Calculate visible segments (time not covered by overlaps)
    total_minutes = 0
    current_pos = evt_start

    for overlap_start, overlap_end in overlaps:
        # Add time before this overlap
        if current_pos < overlap_start:
            segment_end = min(overlap_start, evt_end)
            total_minutes += segment_end - current_pos
        # Move past this overlap
        current_pos = max(current_pos, overlap_end)

    # Add remaining time after last overlap
    if current_pos < evt_end:
        total_minutes += evt_end - current_pos

    return total_minutes / 60.0

def calculate_stats(events):
    """
    Calculates statistics for the schedule.
    Returns a dictionary with totals by type and overall total.
    Accounts for overlaps reducing overwriteable event durations.
    """
    stats = {}
    total_hours = 0.0

    # Initialize standard categories to ensure they appear
    standard_types = ['class', 'work', 'exercise', 'food', 'commute', 'other']
    for t in standard_types:
        stats[t] = 0.0

    for event in events:
        hours = calculate_effective_duration(event, events)
        etype = event.get('type', 'other')

        stats[etype] = stats.get(etype, 0.0) + hours
        total_hours += hours

    return {
        "by_category": stats,
        "total": total_hours
    }

def get_category_breakdown(events, category):
    """
    Returns specific activities for a category.
    Uses effective duration accounting for overlaps.
    """
    # Filter events of this category first
    category_events = [e for e in events if e.get('type') == category]

    activities = []
    for event in category_events:
        hours = calculate_effective_duration(event, events)
        activities.append({
            "title": event.get('title'),
            "sub": event.get('sub', ''),
            "day": event.get('day'),
            "hours": hours
        })
    return activities
