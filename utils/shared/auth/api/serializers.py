"""Thin request/response helpers for the auth views. No business logic."""

from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response

from utils.shared.auth.errors import AuthError, RateLimited

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
    "rate_limited": status.HTTP_429_TOO_MANY_REQUESTS,
}


def error_response(exc: AuthError) -> Response:
    body = {"code": exc.code, "message": exc.message, "details": exc.details}
    response = Response(body, status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR))
    if isinstance(exc, RateLimited):
        response["Retry-After"] = str(exc.retry_after_seconds)
    return response


def object_payload(data: Any) -> dict:
    return data if isinstance(data, dict) else {}
