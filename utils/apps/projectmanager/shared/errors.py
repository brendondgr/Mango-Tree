from __future__ import annotations


class ProjectManagerError(Exception):
    """Base error for the projectmanager app. Maps to the five platform error
    codes surfaced by both the DRF API and the agent tools."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(ProjectManagerError):
    code = "validation_error"


class PermissionDeniedError(ProjectManagerError):
    code = "permission_denied"


class NotFoundError(ProjectManagerError):
    code = "not_found"


class ConflictError(ProjectManagerError):
    code = "conflict"
