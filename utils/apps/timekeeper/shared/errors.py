from __future__ import annotations


class TimekeeperError(Exception):
    """Base error for the timekeeper app. Maps to the five platform error codes
    surfaced by both the DRF API and the agent tools."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(TimekeeperError):
    code = "validation_error"


class PermissionDeniedError(TimekeeperError):
    code = "permission_denied"


class NotFoundError(TimekeeperError):
    code = "not_found"


class ConflictError(TimekeeperError):
    code = "conflict"
