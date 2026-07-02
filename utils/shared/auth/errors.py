"""Stable error taxonomy for the auth API, mirroring the platform-wide
``{code, message, details}`` contract used by the app modules."""

from __future__ import annotations

from typing import Any


class AuthError(Exception):
    """Base class carrying a stable ``code`` that maps to an HTTP status."""

    code = "internal_error"

    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class ValidationError(AuthError):
    code = "validation_error"


class PermissionDenied(AuthError):
    code = "permission_denied"


class NotFound(AuthError):
    code = "not_found"


class Conflict(AuthError):
    code = "conflict"


class RateLimited(AuthError):
    """Raised when an IP is locked out after too many failed attempts."""

    code = "rate_limited"

    def __init__(self, message: str, retry_after_seconds: int, details: Any = None) -> None:
        super().__init__(message, details)
        self.retry_after_seconds = retry_after_seconds
