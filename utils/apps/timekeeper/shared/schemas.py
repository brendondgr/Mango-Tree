"""Data transfer objects shared by the services, DRF API, and agent tools.

The read DTO (``TimeLogDTO``) owns ``to_dict`` — the JSON shape returned by both
the API and the agent tools. The input parsers (``parse_intervals``,
``validate_date``, ``validate_categories``) are the single validation entry point,
raising the app's typed :class:`ValidationError`.

The category taxonomy is intentionally kept as free-form JSON (categories carry a
``colorId`` and subcategories a shade level ``l``, plus any future keys), so it is
validated structurally and passed through unchanged rather than coerced into a
rigid DTO.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from utils.apps.timekeeper.shared.constants import MAX_BLOCK_INDEX
from utils.apps.timekeeper.shared.errors import ValidationError
from utils.apps.timekeeper.shared.intervals import Interval


# --- read DTO -----------------------------------------------------------------

@dataclass(frozen=True)
class TimeLogDTO:
    id: int
    date: str
    start_time: str
    duration: int
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "date": self.date,
            "start_time": self.start_time,
            "duration": self.duration,
            "category_id": self.category_id,
            "subcategory_id": self.subcategory_id,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# --- input validation ---------------------------------------------------------

def validate_date(value: Any) -> str:
    """Require a non-empty ``YYYY-MM-DD`` date string."""
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(
            "'date' is required and must be a non-empty string",
            details={"field": "date"},
        )
    text = value.strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        raise ValidationError(
            "'date' must be an ISO date (YYYY-MM-DD)",
            details={"field": "date"},
        )
    return text


def _opt_id(data: dict, key: str) -> Optional[str]:
    value = data.get(key)
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string", details={"field": key})
    return value


def parse_interval(data: Any) -> Interval:
    """Validate one painted-block descriptor into an :class:`Interval`."""
    if not isinstance(data, dict):
        raise ValidationError("each interval must be an object", details={"field": "intervals"})
    index = data.get("index")
    # bool is an int subclass — reject it explicitly.
    if not isinstance(index, int) or isinstance(index, bool):
        raise ValidationError(
            "'index' must be an integer block index",
            details={"field": "index"},
        )
    if index < 0 or index > MAX_BLOCK_INDEX:
        raise ValidationError(
            f"'index' must be between 0 and {MAX_BLOCK_INDEX}",
            details={"field": "index", "index": index},
        )
    return Interval(
        index=index,
        category_id=_opt_id(data, "category_id"),
        subcategory_id=_opt_id(data, "subcategory_id"),
    )


def parse_intervals(value: Any) -> list[Interval]:
    """Validate the ``intervals`` payload into a list of :class:`Interval`."""
    if not isinstance(value, list):
        raise ValidationError("'intervals' must be a list", details={"field": "intervals"})
    return [parse_interval(item) for item in value]


def validate_categories(value: Any) -> list[dict]:
    """Structurally validate the category taxonomy, preserving all extra keys.

    Requires a list of objects, each with a string ``id`` and ``name`` and a list
    ``subcategories`` (each a string ``id`` + ``name``). Any additional keys
    (``colorId``, ``l``, …) are kept verbatim.
    """
    if not isinstance(value, list):
        raise ValidationError("categories must be a list", details={"field": "categories"})
    for cat in value:
        if not isinstance(cat, dict):
            raise ValidationError("each category must be an object", details={"field": "categories"})
        if not isinstance(cat.get("id"), str) or not isinstance(cat.get("name"), str):
            raise ValidationError(
                "each category needs a string 'id' and 'name'",
                details={"field": "categories"},
            )
        subs = cat.get("subcategories", [])
        if not isinstance(subs, list):
            raise ValidationError(
                "'subcategories' must be a list",
                details={"field": "subcategories"},
            )
        for sub in subs:
            if not isinstance(sub, dict) or not isinstance(sub.get("id"), str) or not isinstance(sub.get("name"), str):
                raise ValidationError(
                    "each subcategory needs a string 'id' and 'name'",
                    details={"field": "subcategories"},
                )
    return value
