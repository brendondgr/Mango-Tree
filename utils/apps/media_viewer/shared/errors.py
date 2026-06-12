from __future__ import annotations


class ArtifactError(Exception):
    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(ArtifactError):
    code = "validation_error"


class PermissionDeniedError(ArtifactError):
    code = "permission_denied"


class NotFoundError(ArtifactError):
    code = "not_found"


class ConflictError(ArtifactError):
    code = "conflict"
