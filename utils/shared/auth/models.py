"""Django-owned auth models on the ``default`` database.

- ``UserPreferences`` — per-owner enabled apps + onboarding state.
- ``LoginAttempt`` — append-only audit log of every login attempt.

The chosen apps/onboarding flag hang off Django's built-in ``auth.User`` via a
one-to-one, so we reuse Django's battle-tested password hashing and sessions
rather than rolling a custom user model."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from utils.shared.auth.constants import default_enabled_apps


class UserPreferences(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferences",
    )
    # List of workspace-app ids the owner has enabled (registry ids like
    # "mediaviewer", "calendar", ...). The chat window is always available.
    enabled_apps = models.JSONField(default=default_enabled_apps)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "mango_auth"

    def __str__(self) -> str:  # pragma: no cover - debug aid
        return f"Preferences({self.user_id})"


class LoginAttempt(models.Model):
    """One row per login attempt (successful or failed). Append-only audit trail
    surfaced in the Settings → Security panel.

    ``counts_toward_lockout`` starts True for failures; a manual unlock flips the
    outstanding failures for an IP to False so the log is preserved while the
    lockout counter resets."""

    username = models.CharField(max_length=150, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    successful = models.BooleanField(default=False)
    counts_toward_lockout = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = "mango_auth"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ip_address", "created_at"]),
        ]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "successful": self.successful,
            "created_at": self.created_at.isoformat(),
        }
