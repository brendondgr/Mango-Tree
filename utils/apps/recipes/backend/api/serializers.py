"""Thin (de)serialization helpers for the recipes API.

The DTOs in ``shared/schemas.py`` already define the schema (``from_dict`` for
validation, ``to_dict`` for output), so the API layer only needs request-body
guarding, list-param coercion, and a standard pagination envelope."""

from __future__ import annotations

from typing import Any

from utils.apps.recipes.shared.constants import DEFAULT_PAGE_SIZE
from utils.apps.recipes.shared.errors import ValidationError

MAX_PAGE_SIZE = 2000


def parse_object(data: Any) -> dict:
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    return data


def str_list(value: Any, *, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f"'{field_name}' must be a list", details={"field": field_name})
    return [str(item).strip() for item in value if str(item).strip()]


def int_list(value: Any, *, field_name: str) -> list[int]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f"'{field_name}' must be a list", details={"field": field_name})
    try:
        return [int(item) for item in value]
    except (TypeError, ValueError):
        raise ValidationError(
            f"'{field_name}' must contain integers", details={"field": field_name}
        ) from None


def _int_param(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def paginate(request, items: list[dict]) -> dict:
    """Wrap a fully-materialized list in the platform list envelope (page size 25;
    clients may request up to ``MAX_PAGE_SIZE``)."""
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
