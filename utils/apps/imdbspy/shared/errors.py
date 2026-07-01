from __future__ import annotations


class ImdbspyError(Exception):
    """Base error for the IMDbSpy app. Maps to the five platform error codes."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(ImdbspyError):
    code = "validation_error"


class PermissionDeniedError(ImdbspyError):
    code = "permission_denied"


class NotFoundError(ImdbspyError):
    code = "not_found"


class ConflictError(ImdbspyError):
    code = "conflict"
