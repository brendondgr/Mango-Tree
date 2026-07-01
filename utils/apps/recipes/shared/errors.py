from __future__ import annotations


class RecipesError(Exception):
    """Base error for the recipes app. Maps to the five platform error codes
    surfaced by both the DRF API and the agent tools."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(RecipesError):
    code = "validation_error"


class PermissionDeniedError(RecipesError):
    code = "permission_denied"


class NotFoundError(RecipesError):
    code = "not_found"


class ConflictError(RecipesError):
    code = "conflict"
