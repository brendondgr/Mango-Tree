import re
from .colors import VALID_COLOR_NAMES

def validate_schedule_structure(data):
    """
    Validates that the provided dictionary matches the expected schedule structure.
    Returns (True, None) if valid, or (False, error_message) if invalid.
    """
    if not isinstance(data, dict):
        return False, "Root must be a JSON object"

    required_keys = ["name", "events"]
    for key in required_keys:
        if key not in data:
            return False, f"Missing required key: '{key}'"

    if not isinstance(data["events"], list):
        return False, "'events' must be a list"

    # Validate optional color_mappings
    if "color_mappings" in data:
        valid, msg = validate_color_mappings(data["color_mappings"])
        if not valid:
            return False, msg

    for i, event in enumerate(data["events"]):
        valid, msg = validate_event(event)
        if not valid:
            return False, f"Event #{i}: {msg}"

    return True, None


def validate_color_mappings(color_mappings):
    """
    Validates the color_mappings field.
    Must be a dict mapping type names (strings) to valid color names.
    """
    if not isinstance(color_mappings, dict):
        return False, "'color_mappings' must be an object"

    for type_name, color_name in color_mappings.items():
        if not isinstance(type_name, str):
            return False, f"color_mappings key must be a string, got {type(type_name)}"
        if not isinstance(color_name, str):
            return False, f"color_mappings value for '{type_name}' must be a string"
        if color_name not in VALID_COLOR_NAMES:
            return False, f"Invalid color '{color_name}' for type '{type_name}'. Valid colors: {', '.join(VALID_COLOR_NAMES)}"

    return True, None

def validate_event(event):
    """
    Validates a single event object (supports timestamps or legacy).
    Optional field: 'overwriteable' (boolean, default false)
      - true: event can be visually split when overlapped by non-overwriteable events
      - false/omitted: event takes priority and cannot be overwritten
    """
    # Validate optional overwriteable field if present
    if "overwriteable" in event:
        if not isinstance(event["overwriteable"], bool):
            return False, "'overwriteable' must be a boolean"

    if "timestamps" in event:
        # Validate base fields
        for field in ["title", "type"]:
            if field not in event:
                return False, f"Missing field '{field}'"

        # Validate timestamps list
        if not isinstance(event["timestamps"], list):
            return False, "'timestamps' must be a list"

        for i, ts in enumerate(event["timestamps"]):
            valid, msg = validate_timestamp(ts)
            if not valid:
                return False, f"Timestamp #{i}: {msg}"
    else:
        # Legacy validation
        return validate_legacy_event(event)

    return True, None

def validate_timestamp(ts):
    """Validates a single timestamp object within the new structure"""
    required_fields = ["day", "start", "end"]
    for field in required_fields:
        if field not in ts:
            return False, f"Missing field '{field}'"

    # Validate day (0-6) - can be int or list of ints
    valid, msg = validate_day_field(ts["day"])
    if not valid:
        return False, msg

    return validate_time_fields(ts["start"], ts["end"])

def validate_legacy_event(event):
    """Validates the legacy flattened event structure"""
    required_fields = ["day", "start", "end", "title", "type"]
    for field in required_fields:
        if field not in event:
            return False, f"Missing field '{field}'"

    valid, msg = validate_day_field(event["day"])
    if not valid:
        return False, msg

    return validate_time_fields(event["start"], event["end"])

def validate_day_field(day_value):
    """Helper to validate day value (int or list of ints)"""
    if isinstance(day_value, int):
        if not (0 <= day_value <= 6):
            return False, "Day must be an integer between 0 (Mon) and 6 (Sun)"
    elif isinstance(day_value, list):
        if not day_value:
            return False, "Day list cannot be empty"
        for day in day_value:
            if not isinstance(day, int) or not (0 <= day <= 6):
                return False, "Each day in the list must be an integer between 0 (Mon) and 6 (Sun)"
    else:
        return False, "Day must be an integer or a list of integers between 0 (Mon) and 6 (Sun)"
    return True, None

def validate_time_fields(start, end):
    """Helper to validate HH:MM time strings"""
    time_pattern = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
    if not time_pattern.match(start):
        return False, f"Invalid start time format: {start}"
    if not time_pattern.match(end):
        return False, f"Invalid end time format: {end}"
    return True, None

def sanitize_filename(filename):
    """
    Ensures filename is safe and ends with .json
    """
    # Remove directory separators and unsafe characters
    safe_name = re.sub(r'[\\/*?:"<>|]', "", filename)
    safe_name = safe_name.strip()
    if not safe_name.lower().endswith(".json"):
        safe_name += ".json"
    return safe_name
