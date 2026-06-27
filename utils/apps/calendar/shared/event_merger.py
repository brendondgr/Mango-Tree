"""
Event merging logic for combining schedule events with direct calendar events.
Direct events take priority and split schedule events when they overlap.
"""
from typing import List, Dict, Any
from . import date_utils


def mark_event_source(events: List[Dict[str, Any]], source_type: str) -> List[Dict[str, Any]]:
    """
    Mark events with their source type for visual distinction.

    Args:
        events: List of event dictionaries
        source_type: 'schedule' or 'direct'

    Returns:
        Events with _source field added
    """
    for event in events:
        event['_source'] = source_type
    return events


def split_schedule_event(schedule_event: Dict[str, Any],
                         direct_event: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Split a schedule event around a direct event.

    If the direct event overlaps the schedule event, the schedule event is
    split into segments (before and/or after the direct event).

    Args:
        schedule_event: The schedule event to potentially split
        direct_event: The direct event that may overlap

    Returns:
        List of schedule event segments (0-2 segments)
    """
    sched_start = date_utils.parse_time(schedule_event['start'])
    sched_end = date_utils.parse_time(schedule_event['end'])
    direct_start = date_utils.parse_time(direct_event['start'])
    direct_end = date_utils.parse_time(direct_event['end'])

    segments = []

    # Before segment: schedule starts before direct event
    if sched_start < direct_start:
        before_end = min(sched_end, direct_start)
        if sched_start < before_end:
            before_segment = schedule_event.copy()
            before_segment['start'] = date_utils.format_time(sched_start)
            before_segment['end'] = date_utils.format_time(before_end)
            before_segment['_split'] = 'before'
            segments.append(before_segment)

    # After segment: schedule extends past direct event
    if sched_end > direct_end:
        after_start = max(sched_start, direct_end)
        if after_start < sched_end:
            after_segment = schedule_event.copy()
            after_segment['start'] = date_utils.format_time(after_start)
            after_segment['end'] = date_utils.format_time(sched_end)
            after_segment['_split'] = 'after'
            segments.append(after_segment)

    return segments


def process_overlaps(schedule_events: List[Dict[str, Any]],
                     direct_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Process all overlaps between schedule and direct events.

    For each direct event, find overlapping schedule events and split them.
    Schedule events that are fully covered by direct events are removed.

    Args:
        schedule_events: List of schedule events for a day
        direct_events: List of direct events for the same day

    Returns:
        List of processed schedule event segments
    """
    if not direct_events:
        return schedule_events

    # Sort direct events by start time
    sorted_direct = sorted(direct_events, key=lambda e: date_utils.parse_time(e['start']))

    # Process each schedule event against all direct events
    result = []

    for sched_event in schedule_events:
        # Start with the full schedule event
        current_segments = [sched_event]

        for direct_event in sorted_direct:
            # Process each current segment against this direct event
            new_segments = []

            for segment in current_segments:
                seg_start = segment['start']
                seg_end = segment['end']
                dir_start = direct_event['start']
                dir_end = direct_event['end']

                # Check if this segment overlaps with the direct event
                if date_utils.time_overlaps(seg_start, seg_end, dir_start, dir_end):
                    # Split the segment around the direct event
                    split_result = split_schedule_event(segment, direct_event)
                    new_segments.extend(split_result)
                else:
                    # No overlap, keep the segment as-is
                    new_segments.append(segment)

            current_segments = new_segments

        # Add remaining segments to result
        result.extend(current_segments)

    return result


def merge_events(schedule_events: List[Dict[str, Any]],
                 direct_events: List[Dict[str, Any]],
                 date: str) -> List[Dict[str, Any]]:
    """
    Merge schedule events with direct events for a specific date.

    Direct events take priority and split schedule events when they overlap.

    Args:
        schedule_events: Events from the schedule for this day
        direct_events: Direct calendar events for this day
        date: The date (for day-of-week mapping)

    Returns:
        Merged list of events sorted by start time
    """
    # Mark sources
    schedule_marked = mark_event_source([e.copy() for e in schedule_events], 'schedule')
    direct_marked = mark_event_source([e.copy() for e in direct_events], 'direct')

    # Process schedule events to split around direct events
    processed_schedule = process_overlaps(schedule_marked, direct_marked)

    # Combine and sort by start time
    all_events = processed_schedule + direct_marked
    all_events.sort(key=lambda e: date_utils.parse_time(e['start']))

    return all_events


def get_events_for_day(schedule_events: List[Dict[str, Any]],
                       day_index: int) -> List[Dict[str, Any]]:
    """
    Filter schedule events for a specific day of week.

    Args:
        schedule_events: All events from a schedule
        day_index: Day index (0=Monday, 6=Sunday)

    Returns:
        Events that occur on that day
    """
    result = []

    for event in schedule_events:
        event_day = event.get('day')

        if event_day is not None:
            # Handle legacy 1-7 format (Sunday=7) by converting to 0-6
            # Days 0-6 are already in correct format and pass through unchanged
            if event_day == 7:
                normalized = 6  # Sunday
            else:
                normalized = event_day

            if normalized == day_index:
                result.append(event)

    return result
