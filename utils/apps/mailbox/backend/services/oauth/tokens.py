"""Access-token minting: exchange the stored refresh token for a short-lived
access token, cached in-process with a skew buffer.

The IMAP/SMTP layer asks for a fresh access token on each connect; this refreshes
transparently. A dead refresh token surfaces as ``permission_denied`` with
``action: reauthorize`` — the UI turns that into a one-click Reconnect, never a
silent retry loop. The token endpoint is an injectable seam for offline tests.
"""

from __future__ import annotations

import time
from typing import Any, Callable

from utils.apps.mailbox.backend.services.oauth import transport as _transport
from utils.apps.mailbox.backend.services.oauth.registry import OAuthProvider, get_provider
from utils.apps.mailbox.shared.errors import PermissionDeniedError

SKEW_SECONDS = 60

# account_id -> (access_token, expiry_epoch). Process-local cache.
_CACHE: dict[str, tuple[str, float]] = {}

PostTransport = Callable[[str, dict[str, str]], tuple[int, Any]]


def get_access_token(
    account: Any,
    *,
    get_refresh: Callable[[str], Any],
    set_refresh: Callable[[str, Any], None] | None = None,
    transport: PostTransport | None = None,
    now: float | None = None,
    cache: dict[str, tuple[str, float]] | None = None,
    provider_config: OAuthProvider | None = None,
) -> str:
    """Return a valid access token for ``account``, refreshing if needed."""
    cache = _CACHE if cache is None else cache
    ts = now if now is not None else time.time()

    hit = cache.get(account.id)
    if hit and (hit[1] - SKEW_SECONDS) > ts:
        return hit[0]

    if not account.credential_ref:
        raise PermissionDeniedError(
            f"{account.provider} account is not connected; sign in again",
            details={"missing": "credential", "action": "reauthorize"},
        )
    refresh = get_refresh(account.credential_ref)
    # Tolerate a legacy bundle dict; the portal flow stores a plain string.
    if isinstance(refresh, dict):
        refresh = refresh.get("refresh_token")
    if not refresh:
        raise PermissionDeniedError(
            f"{account.provider} has no refresh token; reconnect the account",
            details={"missing": "refresh_token", "action": "reauthorize"},
        )

    p = provider_config or get_provider(account.provider)
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "client_id": p.client_id,
    }
    if p.client_secret:
        data["client_secret"] = p.client_secret

    status, body = (transport or _transport.post_form)(p.token_url, data)
    body = body if isinstance(body, dict) else {}
    if status >= 400:
        raise PermissionDeniedError(
            f"{account.provider} token refresh failed; reconnect the account",
            details={"status": status, "error": body.get("error"), "action": "reauthorize"},
        )

    token = body.get("access_token")
    if not token:
        raise PermissionDeniedError(
            f"{account.provider} token endpoint returned no access token",
            details={"action": "reauthorize"},
        )
    cache[account.id] = (token, ts + int(body.get("expires_in", 3600)))

    # Microsoft rotates refresh tokens on use — persist a new one if returned.
    if body.get("refresh_token") and set_refresh is not None:
        set_refresh(account.credential_ref, body["refresh_token"])

    return token
