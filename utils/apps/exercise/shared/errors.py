from __future__ import annotations


class ExerciseError(Exception):
    """Base error for the exercise app. Maps to the five platform error codes."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(ExerciseError):
    code = "validation_error"


class PermissionDeniedError(ExerciseError):
    code = "permission_denied"


class NotFoundError(ExerciseError):
    code = "not_found"


class ConflictError(ExerciseError):
    code = "conflict"
