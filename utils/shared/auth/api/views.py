"""DRF views for the auth API, mounted at ``/api/auth/``.

Thin: parse -> service -> serialize. Public endpoints (csrf, registration-status,
signup, login) declare AllowAny; everything else inherits the global
IsAuthenticated default. Session login/logout use Django's session framework so
the credential is an httpOnly cookie, never a JS-readable token."""

from __future__ import annotations

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from utils.shared.auth.api.serializers import error_response, object_payload
from utils.shared.auth.errors import AuthError, PermissionDenied, RateLimited, ValidationError
from utils.shared.auth.services import accounts as accounts_service
from utils.shared.auth.services import lockout as lockout_service


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request: Request) -> Response:
    """Prime the CSRF cookie and hand the token back to the SPA."""
    token = get_token(request)
    return Response({"csrftoken": token})


@api_view(["GET"])
@permission_classes([AllowAny])
def registration_status(request: Request) -> Response:
    return Response(
        {
            "registration_open": accounts_service.registration_open(),
            "owner_exists": accounts_service.owner_exists(),
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request: Request) -> Response:
    """First-run owner creation. Closed once an owner exists."""
    payload = object_payload(request.data)
    try:
        user = accounts_service.create_owner(payload.get("username"), payload.get("password"))
    except AuthError as exc:
        return error_response(exc)

    # Log the new owner straight in so they land in onboarding without a second
    # round-trip.
    django_login(request, user)
    lockout_service.record_attempt(
        username=user.username,
        ip_address=lockout_service.client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        successful=True,
    )
    return Response(accounts_service.user_dict(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request: Request) -> Response:
    payload = object_payload(request.data)
    ip_address = lockout_service.client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    # Refuse before touching credentials if the IP is locked out.
    state = lockout_service.lock_state(ip_address)
    if state["locked"]:
        return error_response(
            RateLimited(
                "Too many failed attempts. Try again later.",
                retry_after_seconds=state["retry_after_seconds"],
                details={"retry_after_seconds": state["retry_after_seconds"]},
            )
        )

    username = payload.get("username")
    user = accounts_service.check_credentials(username, payload.get("password"))
    lockout_service.record_attempt(
        username=str(username or ""),
        ip_address=ip_address,
        user_agent=user_agent,
        successful=user is not None,
    )
    if user is None:
        return error_response(ValidationError("Invalid username or password."))

    django_login(request, user)
    return Response(accounts_service.user_dict(user))


@api_view(["POST"])
def logout(request: Request) -> Response:
    django_logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def me(request: Request) -> Response:
    return Response(accounts_service.user_dict(request.user))


@api_view(["GET", "PATCH"])
def preferences(request: Request) -> Response:
    if request.method == "GET":
        return Response(accounts_service.preferences_dict(request.user))
    payload = object_payload(request.data)
    try:
        updated = accounts_service.update_preferences(
            request.user,
            enabled_apps=payload.get("enabled_apps"),
            onboarding_completed=payload.get("onboarding_completed"),
        )
    except AuthError as exc:
        return error_response(exc)
    return Response(updated)


# --- Settings → Security section ---------------------------------------------


@api_view(["GET"])
def security_attempts(request: Request) -> Response:
    return Response({"attempts": lockout_service.list_attempts()})


@api_view(["GET"])
def security_lockouts(request: Request) -> Response:
    return Response({"lockouts": lockout_service.list_locked_ips()})


@api_view(["POST"])
def security_unlock(request: Request) -> Response:
    payload = object_payload(request.data)
    ip_address = payload.get("ip_address")
    if not isinstance(ip_address, str) or not ip_address.strip():
        return error_response(ValidationError("ip_address is required.", {"field": "ip_address"}))
    cleared = lockout_service.unlock_ip(ip_address.strip())
    return Response({"ip_address": ip_address.strip(), "cleared": cleared})
