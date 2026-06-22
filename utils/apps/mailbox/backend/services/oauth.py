"""OAuth2 access-token minting for the IMAP/SMTP providers (Gmail, M365).

The persisted secret for an OAuth account is a *bundle* — the long-lived
``refresh_token`` plus the app's ``client_id`` / ``client_secret`` — not a raw
access token (which expires in ~1h). ``resolve_access_token`` returns a cached
access token while it is still valid, otherwise exchanges the refresh token at
the provider's token endpoint for a fresh one, and hands the refreshed bundle to
``on_refresh`` so the cache (the secret store) can be updated.

Local-first: no broker, no Redis. The token endpoint call sits behind an
injectable ``transport`` seam so this is unit-testable with no network. A dead
refresh token (``invalid_grant``) raises ``PermissionDeniedError`` with
``action: reauthorize`` — callers must not silently retry.
"""

from __future__ import annotations

from typing import Any, Callable

from utils.apps.mailbox.shared.errors import PermissionDeniedError, ValidationError

# Provider token endpoints. Exchange (on-prem) is basic-auth, not OAuth here.
TOKEN_ENDPOINTS = {
    "gmail": "https://oauth2.googleapis.com/token",
    "m365": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
}

# M365 needs the IMAP/SMTP scopes echoed on refresh; Google does not.
_REFRESH_SCOPES = {
    "m365": (
        "https://outlook.office365.com/IMAP.AccessAsUser.All "
        "https://outlook.office365.com/SMTP.Send offline_access"
    ),
}

SKEW_SECONDS = 60

Transport = Callable[[str, dict[str, str]], tuple[int, Any]]


def _default_transport(url: str, form: dict[str, str]) -> tuple[int, Any]:
    import requests  # lazy: optional dependency

    resp = requests.post(url, data=form, timeout=30)
    try:
        parsed = resp.json() if resp.content else {}
    except ValueError:
        parsed = {"raw": resp.text}
    return resp.status_code, parsed


def resolve_access_token(
    provider: str,
    bundle: dict[str, Any],
    *,
    now: float,
    transport: Transport | None = None,
    on_refresh: Callable[[dict[str, Any]], None] | None = None,
    skew: int = SKEW_SECONDS,
) -> str:
    """Return a valid access token for ``bundle``, refreshing if needed.

    ``bundle`` keys: ``refresh_token``, ``client_id``, ``client_secret``, and the
    cached ``access_token`` / ``access_token_expiry`` (epoch seconds).
    """
    access = bundle.get("access_token")
    expiry = bundle.get("access_token_expiry")
    refresh = bundle.get("refresh_token")

    # 1. cached token still valid (with skew)
    if access and isinstance(expiry, (int, float)) and (expiry - skew) > now:
        return access

    # 2. no refresh token: fall back to a static access token (dev), else deny
    if not refresh:
        if access:
            return access
        raise PermissionDeniedError(
            f"{provider} account has no refresh token; re-authorize it",
            details={"missing": "refresh_token", "action": "reauthorize"},
        )

    # 3. refresh
    client_id = bundle.get("client_id")
    client_secret = bundle.get("client_secret")
    if not client_id or not client_secret:
        raise PermissionDeniedError(
            f"{provider} refresh needs client_id and client_secret",
            details={"missing": "client_credentials", "action": "reauthorize"},
        )
    endpoint = TOKEN_ENDPOINTS.get(provider)
    if not endpoint:
        raise ValidationError(
            f"no OAuth token endpoint for provider '{provider}'",
            details={"provider": provider},
        )

    form = {
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    if provider in _REFRESH_SCOPES:
        form["scope"] = _REFRESH_SCOPES[provider]

    status, data = (transport or _default_transport)(endpoint, form)
    data = data if isinstance(data, dict) else {}
    if status >= 400:
        # invalid_grant (revoked / expired refresh token) is terminal.
        raise PermissionDeniedError(
            f"{provider} token refresh failed ({status})",
            details={"status": status, "error": data.get("error"), "action": "reauthorize"},
        )

    new_access = data.get("access_token")
    if not new_access:
        raise PermissionDeniedError(
            f"{provider} token endpoint returned no access_token",
            details={"action": "reauthorize"},
        )

    if on_refresh is not None:
        updated = dict(bundle)
        updated["access_token"] = new_access
        updated["access_token_expiry"] = now + int(data.get("expires_in", 3600))
        # refresh tokens normally do not rotate, but honor one if returned (MS can).
        if data.get("refresh_token"):
            updated["refresh_token"] = data["refresh_token"]
        on_refresh(updated)

    return new_access
