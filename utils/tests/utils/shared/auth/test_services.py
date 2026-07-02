"""Unit tests for the auth services: owner lifecycle, preferences, and the IP
lockout state machine."""

from __future__ import annotations

import pytest

from utils.shared.auth.constants import MAX_FAILED_ATTEMPTS
from utils.shared.auth.errors import PermissionDenied, ValidationError
from utils.shared.auth.services import accounts, lockout


def test_owner_signup_is_single_use(auth_db):
    assert accounts.registration_open() is True
    user = accounts.create_owner("owner", "correct horse staple 42")
    assert user.is_superuser is True
    assert accounts.owner_exists() is True
    assert accounts.registration_open() is False

    with pytest.raises(PermissionDenied):
        accounts.create_owner("intruder", "another strong pass 99")


def test_signup_rejects_weak_password(auth_db):
    with pytest.raises(ValidationError):
        accounts.create_owner("owner", "short")


def test_default_preferences(auth_db):
    user = accounts.create_owner("owner", "correct horse staple 42")
    prefs = accounts.preferences_dict(user)
    assert prefs == {"enabled_apps": ["mediaviewer"], "onboarding_completed": False}


def test_update_preferences_dedupes_and_validates(auth_db):
    user = accounts.create_owner("owner", "correct horse staple 42")
    updated = accounts.update_preferences(
        user,
        enabled_apps=["calendar", "calendar", "recipes"],
        onboarding_completed=True,
    )
    assert updated == {
        "enabled_apps": ["calendar", "recipes"],
        "onboarding_completed": True,
    }
    with pytest.raises(ValidationError):
        accounts.update_preferences(user, enabled_apps=[1, 2])


def test_check_credentials(auth_db):
    accounts.create_owner("owner", "correct horse staple 42")
    assert accounts.check_credentials("owner", "correct horse staple 42") is not None
    assert accounts.check_credentials("owner", "wrong") is None
    assert accounts.check_credentials(None, None) is None


def test_lockout_after_threshold_and_reset_on_success(auth_db):
    ip = "203.0.113.7"
    for _ in range(MAX_FAILED_ATTEMPTS):
        lockout.record_attempt(username="owner", ip_address=ip, user_agent="", successful=False)
    state = lockout.lock_state(ip)
    assert state["locked"] is True
    assert state["retry_after_seconds"] > 0

    # A success clears the outstanding counter (own-typo protection).
    lockout.record_attempt(username="owner", ip_address=ip, user_agent="", successful=True)
    assert lockout.is_locked(ip) is False


def test_manual_unlock_preserves_log(auth_db):
    ip = "203.0.113.9"
    for _ in range(MAX_FAILED_ATTEMPTS):
        lockout.record_attempt(username="owner", ip_address=ip, user_agent="", successful=False)
    assert lockout.is_locked(ip) is True

    cleared = lockout.unlock_ip(ip)
    assert cleared == MAX_FAILED_ATTEMPTS
    assert lockout.is_locked(ip) is False
    # The attempts remain in the audit log even though they no longer count.
    assert len(lockout.list_attempts()) == MAX_FAILED_ATTEMPTS
