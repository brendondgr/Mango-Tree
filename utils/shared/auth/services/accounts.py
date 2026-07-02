"""Owner account lifecycle: first-run signup, credential checks, and the
per-owner preferences read/update surface.

The platform is single-owner: signup is only permitted while no account exists.
Once the owner is created, registration is closed and further signups are
rejected — a public deployment must never allow open registration."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import authenticate as django_authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from utils.shared.auth.errors import Conflict, PermissionDenied, ValidationError
from utils.shared.auth.models import UserPreferences

_USERNAME_MAX = 150


def owner_exists() -> bool:
    """True once the single owner account has been created."""
    return User.objects.exists()


def registration_open() -> bool:
    return not owner_exists()


def _clean_username(raw: Any) -> str:
    username = (raw or "").strip() if isinstance(raw, str) else ""
    if not username:
        raise ValidationError("Username is required.", {"field": "username"})
    if len(username) > _USERNAME_MAX:
        raise ValidationError("Username is too long.", {"field": "username"})
    return username


def create_owner(username: Any, password: Any) -> User:
    """Create the single owner account. Rejected once an owner already exists."""
    if owner_exists():
        raise PermissionDenied(
            "Registration is closed: an account already exists.",
            {"reason": "registration_closed"},
        )

    username = _clean_username(username)
    if not isinstance(password, str) or not password:
        raise ValidationError("Password is required.", {"field": "password"})

    # Build (unsaved) user so validators can check similarity to the username.
    user = User(username=username)
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError("Password does not meet requirements.", {"errors": exc.messages})

    if User.objects.filter(username=username).exists():  # pragma: no cover - race guard
        raise Conflict("That username is taken.", {"field": "username"})

    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.save()
    get_or_create_preferences(user)
    return user


def check_credentials(username: Any, password: Any) -> User | None:
    """Return the user for valid credentials, else None. No side effects."""
    if not isinstance(username, str) or not isinstance(password, str):
        return None
    return django_authenticate(username=username.strip(), password=password)


def get_or_create_preferences(user: User) -> UserPreferences:
    prefs, _ = UserPreferences.objects.get_or_create(user=user)
    return prefs


def preferences_dict(user: User) -> dict:
    prefs = get_or_create_preferences(user)
    return {
        "enabled_apps": list(prefs.enabled_apps or []),
        "onboarding_completed": prefs.onboarding_completed,
    }


def update_preferences(
    user: User,
    *,
    enabled_apps: Any = None,
    onboarding_completed: Any = None,
) -> dict:
    prefs = get_or_create_preferences(user)

    if enabled_apps is not None:
        if not isinstance(enabled_apps, list) or not all(
            isinstance(item, str) for item in enabled_apps
        ):
            raise ValidationError(
                "enabled_apps must be a list of app id strings.",
                {"field": "enabled_apps"},
            )
        # De-duplicate while preserving order.
        seen: set[str] = set()
        cleaned = []
        for app_id in enabled_apps:
            app_id = app_id.strip()
            if app_id and app_id not in seen:
                seen.add(app_id)
                cleaned.append(app_id)
        prefs.enabled_apps = cleaned

    if onboarding_completed is not None:
        if not isinstance(onboarding_completed, bool):
            raise ValidationError(
                "onboarding_completed must be a boolean.",
                {"field": "onboarding_completed"},
            )
        prefs.onboarding_completed = onboarding_completed

    prefs.save()
    return {
        "enabled_apps": list(prefs.enabled_apps or []),
        "onboarding_completed": prefs.onboarding_completed,
    }


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "is_owner": user.is_superuser,
        "preferences": preferences_dict(user),
    }
