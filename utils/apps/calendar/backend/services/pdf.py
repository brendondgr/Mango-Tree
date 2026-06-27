"""
PDF Generator for Schedule Editor.
Generates high-DPI PDF of schedule with current view filters.
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from utils.apps.calendar.shared.colors import PREDEFINED_COLORS

# Page dimensions (landscape letter)
PAGE_WIDTH, PAGE_HEIGHT = landscape(letter)  # 11" x 8.5"

# Margins
MARGIN_LEFT = 0.5 * inch
MARGIN_RIGHT = 0.5 * inch
MARGIN_TOP = 0.5 * inch
MARGIN_BOTTOM = 0.5 * inch

# Layout constants
HEADER_HEIGHT = 0.5 * inch
LEGEND_HEIGHT = 0.35 * inch
GRID_TIME_COL_WIDTH = 0.6 * inch

# Days of week labels
DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

# Build a map from Tailwind bg class to hex colors
_BG_CLASS_TO_HEX = {}
for color in PREDEFINED_COLORS:
    _BG_CLASS_TO_HEX[color['bg']] = {
        'bgHex': color['bgHex'],
        'borderHex': color['borderHex'],
        'textHex': color['textHex']
    }


def hex_to_color(hex_str):
    """Convert hex color string to reportlab Color."""
    hex_str = hex_str.lstrip('#')
    r = int(hex_str[0:2], 16) / 255.0
    g = int(hex_str[2:4], 16) / 255.0
    b = int(hex_str[4:6], 16) / 255.0
    return colors.Color(r, g, b)


def parse_time_to_minutes(time_str):
    """Convert HH:MM time string to minutes from midnight."""
    if not time_str:
        return 0
    parts = time_str.split(':')
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_time_str(minutes):
    """Convert minutes from midnight to HH:MM string."""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def format_hour(hour):
    """Format hour as 12-hour time string."""
    if hour == 0 or hour == 24:
        return "12AM"
    elif hour == 12:
        return "12PM"
    elif hour < 12:
        return f"{hour}AM"
    else:
        return f"{hour - 12}PM"


def get_hex_from_color_scheme(event_type, color_scheme):
    """
    Get hex colors for an event type from the color scheme.
    The color_scheme contains Tailwind classes, we need to map to hex.
    """
    if event_type in color_scheme:
        scheme = color_scheme[event_type]
        bg_class = scheme.get('bg', '')

        # Look up hex colors from the Tailwind class
        if bg_class in _BG_CLASS_TO_HEX:
            return _BG_CLASS_TO_HEX[bg_class]

    # Default gray colors
    return {
        'bgHex': '#e5e7eb',
        'borderHex': '#9ca3af',
        'textHex': '#1f2937'
    }


def time_ranges_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap."""
    return start1 < end2 and end1 > start2


def process_overlap_segments(events):
    """
    Process events to split overwriteable events around non-overwriteable ones.
    This mirrors the frontend processOverlapSegments logic.

    Args:
        events: List of events for a single day

    Returns:
        List of processed events with segments
    """
    # Separate overwriteable and non-overwriteable events
    non_overwriteable = [e for e in events if not e.get('overwriteable', False)]
    overwriteable = [e for e in events if e.get('overwriteable', False)]

    result = []

    # Non-overwriteable events render as-is with higher z-index
    for evt in non_overwriteable:
        result.append({
            **evt,
            '_isSegment': False,
            '_zIndex': 10
        })

    # Process each overwriteable event
    for evt in overwriteable:
        evt_start = parse_time_to_minutes(evt.get('start', '00:00'))
        evt_end = parse_time_to_minutes(evt.get('end', '00:00'))

        # Find all non-overwriteable events that overlap with this one
        overlaps = []
        for ne in non_overwriteable:
            ne_start = parse_time_to_minutes(ne.get('start', '00:00'))
            ne_end = parse_time_to_minutes(ne.get('end', '00:00'))
            if time_ranges_overlap(evt_start, evt_end, ne_start, ne_end):
                overlaps.append({'start': ne_start, 'end': ne_end})

        overlaps.sort(key=lambda x: x['start'])

        if not overlaps:
            # No overlaps, render normally with lower z-index
            result.append({
                **evt,
                '_isSegment': False,
                '_zIndex': 5
            })
            continue

        # Calculate visible segments
        segments = []
        current_pos = evt_start

        for overlap in overlaps:
            # Add segment before this overlap (if there's space)
            if current_pos < overlap['start']:
                segments.append({
                    'start': current_pos,
                    'end': min(overlap['start'], evt_end)
                })
            # Move position past this overlap
            current_pos = max(current_pos, overlap['end'])

        # Add remaining segment after last overlap
        if current_pos < evt_end:
            segments.append({
                'start': current_pos,
                'end': evt_end
            })

        # Create segment events
        for idx, seg in enumerate(segments):
            result.append({
                **evt,
                'start': minutes_to_time_str(seg['start']),
                'end': minutes_to_time_str(seg['end']),
                '_isSegment': True,
                '_segmentIndex': idx,
                '_totalSegments': len(segments),
                '_zIndex': 5,
                '_originalStart': evt.get('start'),
                '_originalEnd': evt.get('end')
            })

    return result


def filter_events(events, view_state, hidden_categories):
    """
    Filter events based on view state and hidden categories.

    Args:
        events: List of expanded event objects
        view_state: Dict with startHour, endHour, and daysRange
        hidden_categories: List of category names to exclude

    Returns:
        Filtered list of events (not yet processed for overlaps)
    """
    hidden_set = set(hidden_categories) if hidden_categories else set()
    start_hour = view_state.get('startHour') or 0
    end_hour = view_state.get('endHour') or 24
    days_range = view_state.get('daysRange')  # List of day indices (0-6) or None for all

    filtered = []
    for event in events:
        # Skip hidden categories
        if event.get('type', '') in hidden_set:
            continue

        # Filter by day if daysRange specified
        if days_range is not None and len(days_range) > 0:
            event_day = event.get('day', 0)
            if event_day not in days_range:
                continue

        # Filter by time range - events use 'start' and 'end' field names
        event_start = parse_time_to_minutes(event.get('start', '00:00'))
        event_end = parse_time_to_minutes(event.get('end', '00:00'))
        range_start = start_hour * 60
        range_end = end_hour * 60

        # Skip events completely outside time range
        if event_end <= range_start or event_start >= range_end:
            continue

        # Clip events to time range
        clipped_event = event.copy()
        if event_start < range_start:
            clipped_event['start'] = minutes_to_time_str(range_start)
        if event_end > range_end:
            clipped_event['end'] = minutes_to_time_str(range_end)

        filtered.append(clipped_event)

    return filtered


def generate_schedule_pdf(schedule_data, events, color_scheme, view_state, hidden_categories):
    """
    Generate a PDF of the schedule.

    Args:
        schedule_data: Dict with schedule name and description
        events: List of expanded events
        color_scheme: Dict mapping event types to color info (Tailwind classes)
        view_state: Dict with startHour, endHour, and daysRange
        hidden_categories: List of hidden category names

    Returns:
        BytesIO buffer containing PDF data
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))

    # Filter events first
    filtered_events = filter_events(events, view_state, hidden_categories)

    # Get visible categories (for legend)
    hidden_set = set(hidden_categories) if hidden_categories else set()
    visible_categories = {e.get('type', '') for e in filtered_events}
    visible_categories = sorted(visible_categories - hidden_set)

    # Calculate time range
    start_hour = view_state.get('startHour') or 0
    end_hour = view_state.get('endHour') or 24
    num_hours = end_hour - start_hour

    # Calculate visible days
    days_range = view_state.get('daysRange')
    if days_range is None or len(days_range) == 0:
        days_range = list(range(7))
    visible_days = sorted(days_range)
    num_days = len(visible_days)

    # Group events by day for overlap processing
    events_by_day = {d: [] for d in visible_days}
    for evt in filtered_events:
        day = evt.get('day', 0)
        if day in events_by_day:
            events_by_day[day].append(evt)

    # Process each day's events for overlaps
    processed_events = []
    for day in visible_days:
        day_events = events_by_day[day]
        processed = process_overlap_segments(day_events)
        processed_events.extend(processed)

    # Calculate grid dimensions
    content_width = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
    content_height = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - HEADER_HEIGHT - LEGEND_HEIGHT

    grid_width = content_width - GRID_TIME_COL_WIDTH
    day_width = grid_width / num_days if num_days > 0 else grid_width
    hour_height = content_height / num_hours if num_hours > 0 else content_height

    grid_left = MARGIN_LEFT + GRID_TIME_COL_WIDTH
    grid_top = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT - LEGEND_HEIGHT

    # Draw header
    _draw_header(c, schedule_data)

    # Draw legend
    _draw_legend(c, visible_categories, color_scheme, grid_top + LEGEND_HEIGHT)

    # Draw grid
    _draw_grid(c, grid_left, grid_top, grid_width, content_height,
               visible_days, start_hour, end_hour, day_width, hour_height)

    # Draw events (now processed for overlaps)
    _draw_events(c, processed_events, color_scheme,
                 grid_left, grid_top, day_width, hour_height,
                 visible_days, start_hour)

    c.save()
    buffer.seek(0)
    return buffer


def _draw_header(c, schedule_data):
    """Draw the header with schedule name and description."""
    y = PAGE_HEIGHT - MARGIN_TOP - 0.3 * inch

    # Schedule name
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(colors.black)
    name = schedule_data.get('name', 'Schedule')
    c.drawString(MARGIN_LEFT, y, name)

    # Description
    description = schedule_data.get('description', '')
    if description:
        c.setFont("Helvetica", 12)
        c.setFillColor(colors.gray)
        c.drawString(MARGIN_LEFT, y - 0.25 * inch, description)


def _draw_legend(c, categories, color_scheme, y_top):
    """Draw the color legend."""
    if not categories:
        return

    x = MARGIN_LEFT
    y = y_top - 0.15 * inch
    swatch_size = 0.12 * inch
    padding = 0.08 * inch

    c.setFont("Helvetica", 10)

    for category in categories:
        # Get colors for this category
        hex_colors = get_hex_from_color_scheme(category, color_scheme)

        # Draw swatch
        bg_color = hex_to_color(hex_colors['bgHex'])
        border_color = hex_to_color(hex_colors['borderHex'])

        c.setFillColor(bg_color)
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.rect(x, y - swatch_size/2, swatch_size, swatch_size, fill=1, stroke=1)

        # Draw label
        c.setFillColor(colors.black)
        label_x = x + swatch_size + padding
        c.drawString(label_x, y - 0.03 * inch, category)

        # Move to next item
        text_width = c.stringWidth(category, "Helvetica", 8)
        x += swatch_size + padding + text_width + 0.2 * inch

        # Wrap to new line if needed
        if x > PAGE_WIDTH - MARGIN_RIGHT - 1 * inch:
            x = MARGIN_LEFT
            y -= 0.2 * inch


def _draw_grid(c, grid_left, grid_top, grid_width, grid_height,
               visible_days, start_hour, end_hour, day_width, hour_height):
    """Draw the time grid with day headers and hour labels."""
    num_hours = end_hour - start_hour
    num_days = len(visible_days)

    # Grid background
    c.setFillColor(colors.white)
    c.rect(grid_left, grid_top - grid_height, grid_width, grid_height, fill=1, stroke=0)

    # Day headers
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.black)
    header_y = grid_top + 0.05 * inch
    for i, day_idx in enumerate(visible_days):
        x = grid_left + i * day_width + day_width / 2
        c.drawCentredString(x, header_y, DAY_LABELS[day_idx])

    # Hour labels and horizontal grid lines
    c.setFont("Helvetica", 10)
    c.setStrokeColor(colors.Color(0.85, 0.85, 0.85))
    c.setLineWidth(0.5)

    for h in range(num_hours + 1):
        y = grid_top - h * hour_height

        # Grid line
        c.line(grid_left, y, grid_left + grid_width, y)

        # Hour label
        if h < num_hours:
            c.setFillColor(colors.gray)
            hour_label = format_hour(start_hour + h)
            label_x = MARGIN_LEFT
            label_y = y - hour_height / 2 - 0.03 * inch
            c.drawString(label_x, label_y, hour_label)

    # Vertical grid lines
    for i in range(num_days + 1):
        x = grid_left + i * day_width
        c.line(x, grid_top, x, grid_top - grid_height)

    # Grid border
    c.setStrokeColor(colors.Color(0.7, 0.7, 0.7))
    c.setLineWidth(1)
    c.rect(grid_left, grid_top - grid_height, grid_width, grid_height, fill=0, stroke=1)


def _draw_events(c, events, color_scheme, grid_left, grid_top,
                 day_width, hour_height, visible_days, start_hour):
    """Draw all events on the grid."""
    # Create day index to column mapping
    day_to_col = {day: i for i, day in enumerate(visible_days)}

    padding = 2  # pixels padding around events

    for event in events:
        day_idx = event.get('day', 0)
        if day_idx not in day_to_col:
            continue

        col = day_to_col[day_idx]

        # Calculate position - events use 'start' and 'end' field names
        start_mins = parse_time_to_minutes(event.get('start', '00:00'))
        end_mins = parse_time_to_minutes(event.get('end', '00:00'))

        start_offset = (start_mins / 60) - start_hour
        end_offset = (end_mins / 60) - start_hour

        x = grid_left + col * day_width + padding
        y_start = grid_top - start_offset * hour_height
        y_end = grid_top - end_offset * hour_height

        width = day_width - 2 * padding
        height = y_start - y_end

        if height <= 0:
            continue

        # Get colors from color scheme
        event_type = event.get('type', '')
        hex_colors = get_hex_from_color_scheme(event_type, color_scheme)

        # Draw event rectangle
        bg_color = hex_to_color(hex_colors['bgHex'])
        border_color = hex_to_color(hex_colors['borderHex'])
        text_color = hex_to_color(hex_colors['textHex'])

        c.setFillColor(bg_color)
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.rect(x, y_end, width, height, fill=1, stroke=1)

        # Draw event text
        c.setFillColor(text_color)

        # Title - use 'title' field, not 'type'
        title = event.get('title', event.get('type', ''))
        text_x = x + 3
        text_y = y_start - 10

        # Calculate available space for text elements
        # We need: title (can be 2 lines), subtitle, time
        # Each line is ~10px, so:
        # - height > 55: can fit title (2 lines) + sub + time
        # - height > 42: can fit title (1 or 2 lines) + sub + time
        # - height > 28: can fit title + sub or time
        # - height > 15: title only

        title_drawn_lines = 0

        if height > 15:
            c.setFont("Helvetica-Bold", 10)
            max_chars_per_line = int(width / 6)

            # Check if we have room for two lines of title
            # We need ~55px for: title (2 lines @ 10px) + sub (10px) + time (10px) + padding
            can_wrap_title = height > 55

            if can_wrap_title and len(title) > max_chars_per_line:
                # Draw title on two lines
                line1 = title[:max_chars_per_line]
                line2 = title[max_chars_per_line:max_chars_per_line*2]
                if len(title) > max_chars_per_line * 2:
                    line2 = line2[:max_chars_per_line-1] + "…"

                c.drawString(text_x, text_y, line1)
                c.drawString(text_x, text_y - 10, line2)
                title_drawn_lines = 2
            else:
                # Single line title
                if len(title) > max_chars_per_line:
                    title = title[:max_chars_per_line-1] + "…"
                c.drawString(text_x, text_y, title)
                title_drawn_lines = 1

        # Calculate Y position for sub/time based on title lines
        sub_y = text_y - (title_drawn_lines * 10)
        time_y = sub_y - 10

        # Subtitle/description (if room) - use 'sub' field - make it bold
        if height > 28 + (title_drawn_lines - 1) * 10:
            sub = event.get('sub', '')
            if sub:
                c.setFont("Helvetica-Bold", 9)
                max_chars = int(width / 5)
                if len(sub) > max_chars:
                    sub = sub[:max_chars-1] + "…"
                c.drawString(text_x, sub_y, sub)

        # Time (if room) - make it bold
        if height > 42 + (title_drawn_lines - 1) * 10:
            time_str = f"{event.get('start', '')} - {event.get('end', '')}"
            c.setFont("Helvetica-Bold", 9)
            c.drawString(text_x, time_y, time_str)
