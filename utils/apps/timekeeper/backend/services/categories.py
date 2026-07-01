"""Category-taxonomy domain logic. Single source of truth for both the DRF API
and the agent tools.

The taxonomy is a single JSON document stored in the ``settings`` key/value table
under the ``categories`` key. Ported from the legacy ``/api/categories``
handlers, preserving the free-form category/subcategory shape.
"""

from __future__ import annotations

import json

from utils.apps.timekeeper.backend.models import Setting
from utils.apps.timekeeper.shared.constants import CATEGORIES_KEY
from utils.apps.timekeeper.shared.errors import ValidationError
from utils.apps.timekeeper.shared.schemas import validate_categories


def get_categories() -> list[dict]:
    """Return the stored category taxonomy, or ``[]`` if none is set. Mirrors
    ``GET /api/categories``."""
    row = Setting.objects.filter(pk=CATEGORIES_KEY).first()
    if row is None or not row.value:
        return []
    try:
        parsed = json.loads(row.value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def save_categories(categories: list[dict]) -> list[dict]:
    """Replace the whole category taxonomy. Mirrors ``POST /api/categories``.

    Validates the structure (preserving all extra keys such as ``colorId`` and
    the subcategory shade ``l``) and stores it as JSON.
    """
    if not isinstance(categories, list):
        raise ValidationError("categories must be a list", details={"field": "categories"})
    validated = validate_categories(categories)
    Setting.objects.update_or_create(
        pk=CATEGORIES_KEY, defaults={"value": json.dumps(validated)}
    )
    return validated
