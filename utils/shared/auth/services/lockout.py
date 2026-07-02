"""Login-attempt audit log and IP lockout.

An IP is locked once it accumulates MAX_FAILED_ATTEMPTS failures (that still
``count_toward_lockout``) within LOCKOUT_WINDOW_MINUTES; the block lifts
LOCKOUT_DURATION_MINUTES after the most recent such failure. A successful login
or a manual unlock clears the outstanding counter without deleting the log."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from utils.shared.auth.constants import (
    ATTEMPT_LOG_LIMIT,
    LOCKOUT_DURATION_MINUTES,
    LOCKOUT_WINDOW_MINUTES,
    MAX_FAILED_ATTEMPTS,
)
from utils.shared.auth.models import LoginAttempt


def client_ip(request) -> str | None:
    """Best-effort client IP. Honors X-Forwarded-For (first hop) when present —
    the public deployment sits behind a reverse proxy."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def _active_failures(ip_address: str):
    """Failed attempts from this IP inside the rolling window that still count."""
    window_start = timezone.now() - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
    return LoginAttempt.objects.filter(
        ip_address=ip_address,
        successful=False,
        counts_toward_lockout=True,
        created_at__gte=window_start,
    )


def lock_state(ip_address: str | None) -> dict:
    """Return ``{"locked": bool, "retry_after_seconds": int, "failed": int}``."""
    if not ip_address:
        return {"locked": False, "retry_after_seconds": 0, "failed": 0}

    failures = _active_failures(ip_address)
    failed = failures.count()
    if failed < MAX_FAILED_ATTEMPTS:
        return {"locked": False, "retry_after_seconds": 0, "failed": failed}

    last_failure = failures.aggregate(latest=Max("created_at"))["latest"]
    unlock_at = last_failure + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    remaining = (unlock_at - timezone.now()).total_seconds()
    if remaining <= 0:
        return {"locked": False, "retry_after_seconds": 0, "failed": failed}
    return {"locked": True, "retry_after_seconds": int(remaining), "failed": failed}


def is_locked(ip_address: str | None) -> bool:
    return lock_state(ip_address)["locked"]


def record_attempt(
    *, username: str, ip_address: str | None, user_agent: str, successful: bool
) -> LoginAttempt:
    """Append an attempt to the audit log. A successful login clears the IP's
    outstanding failure counter so the owner is not locked out by their own
    earlier typos."""
    attempt = LoginAttempt.objects.create(
        username=(username or "")[:150],
        ip_address=ip_address,
        user_agent=(user_agent or "")[:2000],
        successful=successful,
    )
    if successful and ip_address:
        LoginAttempt.objects.filter(
            ip_address=ip_address,
            successful=False,
            counts_toward_lockout=True,
        ).update(counts_toward_lockout=False)
    return attempt


def unlock_ip(ip_address: str) -> int:
    """Clear the outstanding failure counter for an IP. Returns rows cleared.
    The log rows are preserved (only ``counts_toward_lockout`` is flipped)."""
    return LoginAttempt.objects.filter(
        ip_address=ip_address,
        successful=False,
        counts_toward_lockout=True,
    ).update(counts_toward_lockout=False)


def list_attempts(limit: int = ATTEMPT_LOG_LIMIT) -> list[dict]:
    return [a.to_dict() for a in LoginAttempt.objects.all()[:limit]]


def list_locked_ips() -> list[dict]:
    """Distinct IPs currently locked out, with remaining time."""
    ips = (
        LoginAttempt.objects.filter(successful=False, counts_toward_lockout=True)
        .values_list("ip_address", flat=True)
        .distinct()
    )
    locked = []
    for ip in ips:
        if not ip:
            continue
        state = lock_state(ip)
        if state["locked"]:
            locked.append(
                {
                    "ip_address": ip,
                    "failed": state["failed"],
                    "retry_after_seconds": state["retry_after_seconds"],
                }
            )
    return locked
