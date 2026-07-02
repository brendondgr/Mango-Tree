"""Tunable constants for the auth layer. Lockout thresholds may be overridden
via environment variables so a deployment can tighten or relax them without a
code change."""

from __future__ import annotations

import os

# Apps a brand-new owner sees before onboarding. Only the media viewer
# ("Artifacts") is on by default; the chat window is core and always present.
# Every other workspace app is opt-in via onboarding or the Settings menu.
DEFAULT_ENABLED_APPS: list[str] = ["mediaviewer"]


def default_enabled_apps() -> list[str]:
    """Callable default for the JSONField (never share a mutable default)."""
    return list(DEFAULT_ENABLED_APPS)


# --- IP lockout ---------------------------------------------------------------
# After MAX_FAILED_ATTEMPTS failures from one IP within LOCKOUT_WINDOW_MINUTES,
# that IP is blocked for LOCKOUT_DURATION_MINUTES from its most recent failure.
MAX_FAILED_ATTEMPTS: int = int(os.environ.get("MANGO_AUTH_MAX_FAILED_ATTEMPTS", 5))
LOCKOUT_WINDOW_MINUTES: int = int(os.environ.get("MANGO_AUTH_LOCKOUT_WINDOW_MINUTES", 15))
LOCKOUT_DURATION_MINUTES: int = int(os.environ.get("MANGO_AUTH_LOCKOUT_DURATION_MINUTES", 15))

# How many recent attempts the security panel lists by default.
ATTEMPT_LOG_LIMIT: int = 100
