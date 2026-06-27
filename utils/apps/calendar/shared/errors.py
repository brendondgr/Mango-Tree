"""Typed errors for the calendar app.

Every error carries a stable ``code`` that maps to the platform error codes
(``validation_error``, ``permission_denied``, ``not_found``, ``conflict``,
``internal_error``). The DRF view layer and the agent tools translate these into
the shared ``{code, message, details}`` envelope, so callers see consistent codes
regardless of which surface they used.
"""

from __future__ import annotations

from typing import Any


class CalendarError(Exception):
    """Base error; defaults to the platform ``internal_error`` code."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(CalendarError):
    code = "validation_error"


class PermissionDeniedError(CalendarError):
    code = "permission_denied"


class NotFoundError(CalendarError):
    code = "not_found"


class ConflictError(CalendarError):
    code = "conflict"
