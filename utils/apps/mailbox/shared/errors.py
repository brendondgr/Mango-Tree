"""Typed errors for the mailbox app.

One hierarchy shared by the config store, secret store, services, API views, and
agent tools so every layer raises and reports the same stable ``code`` strings.
The five codes map onto the platform's error schema (see ``docs/api.md``).
"""

from __future__ import annotations

from typing import Any


class MailError(Exception):
    """Base error for the mailbox app."""

    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(MailError):
    code = "validation_error"


class PermissionDeniedError(MailError):
    code = "permission_denied"


class ProviderError(MailError):
    code = "provider_error"


class NotFoundError(MailError):
    code = "not_found"


class ConflictError(MailError):
    code = "conflict"
