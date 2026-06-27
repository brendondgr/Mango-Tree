"""Thin (de)serialization helpers for the calendar API.

Schedules and events are plain dicts produced by the services, so the API layer
only guards request bodies, wraps lists in the platform envelope, and maps typed
errors to HTTP status codes.
"""

from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response

from utils.apps.calendar.shared.errors import CalendarError, ValidationError

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 500

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def error_response(exc: CalendarError) -> Response:
    """Render a typed error as the platform ``{code, message, details}`` envelope."""
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


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
