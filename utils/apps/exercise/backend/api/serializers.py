"""Thin (de)serialization helpers for the exercise API.

The DTOs in ``shared/schemas.py`` already define the schema (``from_dict`` for
validation, ``to_dict`` for output), so the API layer only needs request-body
guarding and a standard pagination envelope.
"""

from __future__ import annotations

from typing import Any

from utils.apps.exercise.shared.constants import DEFAULT_PAGE_SIZE
from utils.apps.exercise.shared.errors import ValidationError

MAX_PAGE_SIZE = 2000


def parse_object(data: Any) -> dict:
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    return data


def _int_param(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def paginate(request, items: list[dict]) -> dict:
    """Wrap a fully-materialized list in the platform list envelope.

    Default page size is 25; clients that need the whole collection (e.g. the
    dashboard aggregating all history) may request a larger ``page_size`` up to
    ``MAX_PAGE_SIZE``.
    """
    page = max(_int_param(request.query_params.get("page"), 1), 1)
    page_size = _int_param(request.query_params.get("page_size"), DEFAULT_PAGE_SIZE)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "count": total,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": items[start:end],
    }
