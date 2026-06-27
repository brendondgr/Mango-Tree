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
HEADER_HEIGHT = 0.62 * inch    # taller to hold name + description + breathing room
LEGEND_HEIGHT = 0.38 * inch    # room for one row of swatches plus gap
GRID_TIME_COL_WIDTH = 0.62 * inch

# Design tokens (mirror the web app's token palette)
_COLOR_GRID_LINE = '#e5e7eb'       # subtle horizontal / vertical dividers
_COLOR_GRID_BORDER = '#d1d5db'     # outer grid border
_COLOR_DAY_HEADER_BG = '#f1f5f9'   # day-header band fill
_COLOR_DAY_HEADER_TEXT = '#334155' # day label text
_COLOR_HOUR_LABEL = '#64748b'      # hour label text
_COLOR_TITLE_TEXT = '#0f172a'      # schedule name
_COLOR_DESC_TEXT = '#64748b'       # description / subtitle text
_COLOR_META_TEXT = '#94a3b8'       # footer / muted meta text
_COLOR_LEGEND_LABEL = '#334155'    # legend category name text
_COLOR_DIVIDER = '#e5e7eb'         # thin rule lines

# Left accent bar width (points; ~3 px at 72 dpi)
_ACCENT_BAR_WIDTH = 3.5

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


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_hours(events):
    """Return total scheduled hours for a list of filtered events (before overlap split)."""
    total_mins = 0
    for evt in events:
        s = parse_time_to_minutes(evt.get('start', '00:00'))
        e = parse_time_to_minutes(evt.get('end', '00:00'))
        total_mins += max(0, e - s)
    return total_mins / 60.0


def _compute_hours_by_category(events):
    """Return {category: hours} dict for filtered events."""
    totals = {}
    for evt in events:
        cat = evt.get('type', '')
        s = parse_time_to_minutes(evt.get('start', '00:00'))
        e = parse_time_to_minutes(evt.get('end', '00:00'))
        totals[cat] = totals.get(cat, 0.0) + max(0, e - s) / 60.0
    return totals


def _format_hours(h):
    """Format hours as e.g. 12.0h or 12.5h."""
    if h == int(h):
        return f"{int(h)}h"
    return f"{h:.1f}h"


def _draw_thin_rule(c, x1, y, x2):
    """Draw a hairline rule in the divider colour."""
    c.setStrokeColor(hex_to_color(_COLOR_DIVIDER))
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

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

    # Filter events first (compute hours from this, before overlap split)
    filtered_events = filter_events(events, view_state, hidden_categories)

    # Compute hours statistics from filtered events (before segmentation)
    total_hours = _compute_hours(filtered_events)
    hours_by_cat = _compute_hours_by_category(filtered_events)

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

    # ---------- layout geometry ----------
    # Reserve space at bottom for footer
    FOOTER_HEIGHT = 0.25 * inch
    content_width = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

    # grid_top is the top edge of the grid body (below header + legend)
    grid_top = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT - LEGEND_HEIGHT

    # grid_height fills from grid_top down to footer margin
    grid_height = grid_top - MARGIN_BOTTOM - FOOTER_HEIGHT

    grid_width = content_width - GRID_TIME_COL_WIDTH
    day_width = grid_width / num_days if num_days > 0 else grid_width
    hour_height = grid_height / num_hours if num_hours > 0 else grid_height

    grid_left = MARGIN_LEFT + GRID_TIME_COL_WIDTH

    # Draw layers
    _draw_header(c, schedule_data, total_hours)
    _draw_legend(c, visible_categories, color_scheme, hours_by_cat,
                 grid_top + LEGEND_HEIGHT)
    _draw_grid(c, grid_left, grid_top, grid_width, grid_height,
               visible_days, start_hour, end_hour, day_width, hour_height)
    _draw_events(c, processed_events, color_scheme,
                 grid_left, grid_top, day_width, hour_height,
                 visible_days, start_hour)
    _draw_footer(c)

    c.save()
    buffer.seek(0)
    return buffer


# ---------------------------------------------------------------------------
# Drawing sub-routines
# ---------------------------------------------------------------------------

def _draw_header(c, schedule_data, total_hours):
    """Draw a clean header band with schedule name, description, and total-hours badge."""
    # Top of text area
    y_name = PAGE_HEIGHT - MARGIN_TOP - 0.22 * inch

    name = schedule_data.get('name', 'Schedule')
    description = schedule_data.get('description', '')

    # --- schedule name (left) ---
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(hex_to_color(_COLOR_TITLE_TEXT))
    c.drawString(MARGIN_LEFT, y_name, name)

    # --- description (left, below name) ---
    if description:
        c.setFont("Helvetica", 11)
        c.setFillColor(hex_to_color(_COLOR_DESC_TEXT))
        c.drawString(MARGIN_LEFT, y_name - 0.22 * inch, description)

    # --- right-aligned meta line ---
    # e.g. "Weekly schedule · 41.5 h"
    view_label = "Weekly schedule"
    hours_str = _format_hours(total_hours)
    meta_text = f"{view_label}  ·  {hours_str}"

    c.setFont("Helvetica", 9)
    c.setFillColor(hex_to_color(_COLOR_DESC_TEXT))
    meta_x = PAGE_WIDTH - MARGIN_RIGHT
    meta_y = y_name  # align to name baseline
    c.drawRightString(meta_x, meta_y, meta_text)

    # --- thin divider rule below header ---
    rule_y = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT + 2
    _draw_thin_rule(c, MARGIN_LEFT, rule_y, PAGE_WIDTH - MARGIN_RIGHT)


def _draw_legend(c, categories, color_scheme, hours_by_cat, y_top):
    """Draw rounded swatches with category name + hours, wrapping as needed."""
    if not categories:
        return

    # Vertical centre of the legend band
    y = y_top - LEGEND_HEIGHT / 2 - 1

    x = MARGIN_LEFT
    swatch_size = 9   # points (~9 px)
    gap = 5           # gap between swatch and label
    item_spacing = 14  # gap between legend items

    c.setFont("Helvetica", 8.5)

    for category in categories:
        hex_colors = get_hex_from_color_scheme(category, color_scheme)
        bg_color = hex_to_color(hex_colors['bgHex'])
        border_color = hex_to_color(hex_colors['borderHex'])

        # Rounded swatch
        c.setFillColor(bg_color)
        c.setStrokeColor(border_color)
        c.setLineWidth(0.75)
        swatch_y = y - swatch_size / 2
        c.roundRect(x, swatch_y, swatch_size, swatch_size,
                    radius=2, fill=1, stroke=1)

        # Label: "Category  1.5h"
        cat_hours = hours_by_cat.get(category, 0.0)
        label = f"{category}  {_format_hours(cat_hours)}"
        c.setFillColor(hex_to_color(_COLOR_LEGEND_LABEL))
        c.setStrokeColor(hex_to_color(_COLOR_LEGEND_LABEL))
        label_x = x + swatch_size + gap
        c.drawString(label_x, y - 3, label)

        label_width = c.stringWidth(label, "Helvetica", 8.5)
        x += swatch_size + gap + label_width + item_spacing

        # Wrap to next line if overflowing
        if x > PAGE_WIDTH - MARGIN_RIGHT - 1.5 * inch:
            x = MARGIN_LEFT
            y -= 0.18 * inch


def _draw_grid(c, grid_left, grid_top, grid_width, grid_height,
               visible_days, start_hour, end_hour, day_width, hour_height):
    """Draw the time-of-day grid with styled day headers and hour labels."""
    num_hours = end_hour - start_hour
    num_days = len(visible_days)

    # ---------- white grid background ----------
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.white)
    c.rect(grid_left, grid_top - grid_height, grid_width, grid_height, fill=1, stroke=0)

    # ---------- day header band ----------
    DAY_HEADER_H = 0.22 * inch
    header_band_y = grid_top - DAY_HEADER_H

    c.setFillColor(hex_to_color(_COLOR_DAY_HEADER_BG))
    c.setStrokeColor(hex_to_color(_COLOR_DAY_HEADER_BG))
    c.rect(grid_left, header_band_y, grid_width, DAY_HEADER_H, fill=1, stroke=0)

    # Thin bottom rule on day header band
    _draw_thin_rule(c, grid_left, header_band_y, grid_left + grid_width)

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(hex_to_color(_COLOR_DAY_HEADER_TEXT))
    for i, day_idx in enumerate(visible_days):
        cx = grid_left + i * day_width + day_width / 2
        c.drawCentredString(cx, header_band_y + 5, DAY_LABELS[day_idx])

    # Adjust the body region to sit below the day headers
    body_top = header_band_y
    body_height = grid_height - DAY_HEADER_H

    # ---------- horizontal hour lines ----------
    c.setStrokeColor(hex_to_color(_COLOR_GRID_LINE))
    c.setLineWidth(0.5)

    for h in range(num_hours + 1):
        y = body_top - h * (body_height / num_hours if num_hours > 0 else body_height)
        c.line(grid_left, y, grid_left + grid_width, y)

    # ---------- hour labels ----------
    c.setFont("Helvetica", 8)
    c.setFillColor(hex_to_color(_COLOR_HOUR_LABEL))
    slot_h = body_height / num_hours if num_hours > 0 else body_height
    for h in range(num_hours):
        y_slot_top = body_top - h * slot_h
        label_y = y_slot_top - slot_h / 2 - 3
        hour_label = format_hour(start_hour + h)
        # Right-align within the time column
        c.drawRightString(MARGIN_LEFT + GRID_TIME_COL_WIDTH - 4, label_y, hour_label)

    # ---------- vertical day dividers ----------
    c.setStrokeColor(hex_to_color(_COLOR_GRID_LINE))
    c.setLineWidth(0.5)
    for i in range(1, num_days):
        x = grid_left + i * day_width
        c.line(x, grid_top, x, grid_top - grid_height)

    # ---------- outer border ----------
    c.setStrokeColor(hex_to_color(_COLOR_GRID_BORDER))
    c.setLineWidth(0.75)
    c.rect(grid_left, grid_top - grid_height, grid_width, grid_height, fill=0, stroke=1)


def _draw_events(c, events, color_scheme, grid_left, grid_top,
                 day_width, hour_height, visible_days, start_hour):
    """Draw events as rounded cards with a left accent bar."""
    day_to_col = {day: i for i, day in enumerate(visible_days)}

    # Account for the day-header band inside the grid
    DAY_HEADER_H = 0.22 * inch
    body_top = grid_top - DAY_HEADER_H

    # Internal padding within the event card (points)
    PAD_H = 2    # horizontal pad on left/right
    PAD_V = 2    # vertical pad top/bottom

    CORNER_RADIUS = 3  # rounded rect corner radius (pt)

    # Sort by zIndex so lower-priority events are drawn first
    sorted_events = sorted(events, key=lambda e: e.get('_zIndex', 5))

    for event in sorted_events:
        day_idx = event.get('day', 0)
        if day_idx not in day_to_col:
            continue

        col = day_to_col[day_idx]

        start_mins = parse_time_to_minutes(event.get('start', '00:00'))
        end_mins = parse_time_to_minutes(event.get('end', '00:00'))

        start_offset_h = (start_mins / 60) - start_hour
        end_offset_h = (end_mins / 60) - start_hour

        x = grid_left + col * day_width + PAD_H
        y_top_edge = body_top - start_offset_h * hour_height
        y_bot_edge = body_top - end_offset_h * hour_height

        width = day_width - 2 * PAD_H
        height = y_top_edge - y_bot_edge - PAD_V

        if height <= 1:
            continue

        event_type = event.get('type', '')
        hex_colors = get_hex_from_color_scheme(event_type, color_scheme)

        bg_color = hex_to_color(hex_colors['bgHex'])
        border_color = hex_to_color(hex_colors['borderHex'])
        text_color = hex_to_color(hex_colors['textHex'])

        # --- rounded card background (no visible border — very light hairline) ---
        c.setFillColor(bg_color)
        c.setStrokeColor(hex_to_color('#e5e7eb'))  # near-invisible hairline
        c.setLineWidth(0.4)
        card_y = y_bot_edge + PAD_V
        c.roundRect(x, card_y, width, height, radius=CORNER_RADIUS, fill=1, stroke=1)

        # --- 3pt left accent bar ---
        accent_x = x
        c.setFillColor(border_color)
        c.setStrokeColor(border_color)
        c.setLineWidth(0)
        # Draw as a small rectangle over the left edge of the card
        bar_height = height - 2 * CORNER_RADIUS
        bar_y = card_y + CORNER_RADIUS
        if bar_height > 0:
            c.rect(accent_x, bar_y, _ACCENT_BAR_WIDTH, bar_height, fill=1, stroke=0)
        # Rounded caps at top and bottom of the bar using small circles
        c.circle(accent_x + _ACCENT_BAR_WIDTH / 2, card_y + CORNER_RADIUS,
                 _ACCENT_BAR_WIDTH / 2, fill=1, stroke=0)
        c.circle(accent_x + _ACCENT_BAR_WIDTH / 2, card_y + height - CORNER_RADIUS,
                 _ACCENT_BAR_WIDTH / 2, fill=1, stroke=0)

        # --- text content ---
        # Text starts after the accent bar + padding
        text_x = x + _ACCENT_BAR_WIDTH + 4
        available_width = width - _ACCENT_BAR_WIDTH - 6  # room to the right

        title = event.get('title', event.get('type', ''))
        sub = event.get('sub', '')
        time_str = f"{event.get('start', '')}–{event.get('end', '')}"

        # Measure what fits using 1pt ≈ char width estimates
        def truncate(text, font, size, max_w):
            """Truncate text to fit max_w points."""
            while text and c.stringWidth(text, font, size) > max_w:
                text = text[:-2] + '…'
            return text

        # Start drawing from just below the card top
        ty = card_y + height - PAD_V - 8  # baseline of first line

        if height >= 14:
            # Title (bold)
            c.setFont("Helvetica-Bold", 8.5)
            c.setFillColor(text_color)
            t = truncate(title, "Helvetica-Bold", 8.5, available_width)
            c.drawString(text_x, ty, t)
            ty -= 9

        if height >= 26 and sub:
            # Subtitle
            c.setFont("Helvetica", 7.5)
            c.setFillColor(text_color)
            s = truncate(sub, "Helvetica", 7.5, available_width)
            c.drawString(text_x, ty, s)
            ty -= 8

        if height >= 36:
            # Time string — slightly muted
            c.setFont("Helvetica", 7)
            c.setFillColor(hex_to_color(_COLOR_HOUR_LABEL))
            ts = truncate(time_str, "Helvetica", 7, available_width)
            c.drawString(text_x, ty, ts)


def _draw_footer(c):
    """Draw a thin rule and a muted attribution line at the page bottom."""
    y_rule = MARGIN_BOTTOM + 0.18 * inch
    _draw_thin_rule(c, MARGIN_LEFT, y_rule, PAGE_WIDTH - MARGIN_RIGHT)

    c.setFont("Helvetica", 7.5)
    c.setFillColor(hex_to_color(_COLOR_META_TEXT))
    c.drawString(MARGIN_LEFT, MARGIN_BOTTOM + 4, "Generated with Mango Tree Calendar")
