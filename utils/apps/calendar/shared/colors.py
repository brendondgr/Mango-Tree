"""
Predefined color palette for event types.
16 colors with Tailwind CSS classes for bg, border, text, and hover states.
Includes hex values for PDF generation.
"""

# Ordered list of 16 predefined colors
PREDEFINED_COLORS = [
    {
        'name': 'yellow-orange',
        'bg': 'bg-amber-100',
        'border': 'border-amber-500',
        'text': 'text-amber-900',
        'hover': 'hover:bg-amber-200',
        'bgHex': '#fef3c7',
        'borderHex': '#f59e0b',
        'textHex': '#78350f'
    },
    {
        'name': 'yellow',
        'bg': 'bg-yellow-100',
        'border': 'border-yellow-500',
        'text': 'text-yellow-900',
        'hover': 'hover:bg-yellow-200',
        'bgHex': '#fef9c3',
        'borderHex': '#eab308',
        'textHex': '#713f12'
    },
    {
        'name': 'orange',
        'bg': 'bg-orange-100',
        'border': 'border-orange-500',
        'text': 'text-orange-900',
        'hover': 'hover:bg-orange-200',
        'bgHex': '#ffedd5',
        'borderHex': '#f97316',
        'textHex': '#7c2d12'
    },
    {
        'name': 'red',
        'bg': 'bg-red-100',
        'border': 'border-red-500',
        'text': 'text-red-900',
        'hover': 'hover:bg-red-200',
        'bgHex': '#fee2e2',
        'borderHex': '#ef4444',
        'textHex': '#7f1d1d'
    },
    {
        'name': 'blue',
        'bg': 'bg-blue-100',
        'border': 'border-blue-500',
        'text': 'text-blue-900',
        'hover': 'hover:bg-blue-200',
        'bgHex': '#dbeafe',
        'borderHex': '#3b82f6',
        'textHex': '#1e3a8a'
    },
    {
        'name': 'purple',
        'bg': 'bg-purple-100',
        'border': 'border-purple-500',
        'text': 'text-purple-900',
        'hover': 'hover:bg-purple-200',
        'bgHex': '#f3e8ff',
        'borderHex': '#a855f7',
        'textHex': '#581c87'
    },
    {
        'name': 'teal',
        'bg': 'bg-teal-100',
        'border': 'border-teal-500',
        'text': 'text-teal-900',
        'hover': 'hover:bg-teal-200',
        'bgHex': '#ccfbf1',
        'borderHex': '#14b8a6',
        'textHex': '#134e4a'
    },
    {
        'name': 'light-purple',
        'bg': 'bg-violet-100',
        'border': 'border-violet-500',
        'text': 'text-violet-900',
        'hover': 'hover:bg-violet-200',
        'bgHex': '#ede9fe',
        'borderHex': '#8b5cf6',
        'textHex': '#4c1d95'
    },
    {
        'name': 'light-blue',
        'bg': 'bg-sky-100',
        'border': 'border-sky-500',
        'text': 'text-sky-900',
        'hover': 'hover:bg-sky-200',
        'bgHex': '#e0f2fe',
        'borderHex': '#0ea5e9',
        'textHex': '#0c4a6e'
    },
    {
        'name': 'green',
        'bg': 'bg-emerald-100',
        'border': 'border-emerald-500',
        'text': 'text-emerald-900',
        'hover': 'hover:bg-emerald-200',
        'bgHex': '#d1fae5',
        'borderHex': '#10b981',
        'textHex': '#064e3b'
    },
    {
        'name': 'black',
        'bg': 'bg-gray-800',
        'border': 'border-gray-900',
        'text': 'text-white',
        'hover': 'hover:bg-gray-700',
        'bgHex': '#1f2937',
        'borderHex': '#111827',
        'textHex': '#ffffff'
    },
    {
        'name': 'muted-gray',
        'bg': 'bg-slate-200',
        'border': 'border-slate-500',
        'text': 'text-slate-900',
        'hover': 'hover:bg-slate-300',
        'bgHex': '#e2e8f0',
        'borderHex': '#64748b',
        'textHex': '#0f172a'
    },
    {
        'name': 'brown',
        'bg': 'bg-amber-200',
        'border': 'border-amber-700',
        'text': 'text-amber-900',
        'hover': 'hover:bg-amber-300',
        'bgHex': '#fde68a',
        'borderHex': '#b45309',
        'textHex': '#78350f'
    },
    {
        'name': 'light-pink',
        'bg': 'bg-pink-100',
        'border': 'border-pink-400',
        'text': 'text-pink-900',
        'hover': 'hover:bg-pink-200',
        'bgHex': '#fce7f3',
        'borderHex': '#f472b6',
        'textHex': '#831843'
    },
    {
        'name': 'kiwi',
        'bg': 'bg-lime-100',
        'border': 'border-lime-500',
        'text': 'text-lime-900',
        'hover': 'hover:bg-lime-200',
        'bgHex': '#ecfccb',
        'borderHex': '#84cc16',
        'textHex': '#365314'
    },
    {
        'name': 'rose',
        'bg': 'bg-rose-100',
        'border': 'border-rose-500',
        'text': 'text-rose-900',
        'hover': 'hover:bg-rose-200',
        'bgHex': '#ffe4e6',
        'borderHex': '#f43f5e',
        'textHex': '#881337'
    },
]

# Build lookup dict for fast access by name
_COLOR_BY_NAME = {c['name']: c for c in PREDEFINED_COLORS}

# List of valid color names (for validation)
VALID_COLOR_NAMES = list(_COLOR_BY_NAME.keys())


def get_color_by_name(color_name):
    """
    Get color configuration by name.
    Returns the color dict (with bg, border, text, hover) or None if not found.
    """
    return _COLOR_BY_NAME.get(color_name)


def get_color_classes(color_name):
    """
    Get just the Tailwind classes for a color name (without the 'name' field).
    Returns dict with bg, border, text, hover keys.
    """
    color = _COLOR_BY_NAME.get(color_name)
    if color:
        return {
            'bg': color['bg'],
            'border': color['border'],
            'text': color['text'],
            'hover': color['hover']
        }
    return None


def get_hex_colors(color_name):
    """
    Get hex color values for a color name.
    Returns dict with bgHex, borderHex, textHex keys, or None if not found.
    """
    color = _COLOR_BY_NAME.get(color_name)
    if color:
        return {
            'bgHex': color.get('bgHex', '#e5e7eb'),
            'borderHex': color.get('borderHex', '#9ca3af'),
            'textHex': color.get('textHex', '#1f2937')
        }
    return None


def generate_color_palette(event_types, color_mappings=None):
    """
    Generates a color palette for the given list of event types.

    Args:
        event_types: List of event type strings
        color_mappings: Optional dict mapping type -> color_name (e.g., {"class": "blue"})

    Returns:
        Dictionary mapping type -> color config (bg, border, text, hover)
    """
    color_mappings = color_mappings or {}
    palette = {}

    # Sort event types alphabetically for consistent assignment
    sorted_types = sorted(event_types)

    # Track which colors from the predefined list we've used for unmapped types
    color_index = 0

    for etype in sorted_types:
        # Check if this type has a custom color mapping
        if etype in color_mappings:
            color_name = color_mappings[etype]
            color = get_color_classes(color_name)
            if color:
                palette[etype] = color
                continue

        # No mapping or invalid mapping - assign from predefined palette in order
        palette[etype] = {
            'bg': PREDEFINED_COLORS[color_index % len(PREDEFINED_COLORS)]['bg'],
            'border': PREDEFINED_COLORS[color_index % len(PREDEFINED_COLORS)]['border'],
            'text': PREDEFINED_COLORS[color_index % len(PREDEFINED_COLORS)]['text'],
            'hover': PREDEFINED_COLORS[color_index % len(PREDEFINED_COLORS)]['hover'],
        }
        color_index += 1

    return palette
