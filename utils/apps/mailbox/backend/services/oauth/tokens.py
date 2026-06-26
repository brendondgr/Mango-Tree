"""Access-token minting: exchange the stored refresh token for a short-lived
access token, cached in-process with a skew buffer.

The actual refresh is delegated to the official libraries — ``google-auth`` for
Gmail and ``msal`` for Microsoft 365 — instead of a hand-rolled token POST. Each
provider has a ``minter`` (``OAuthProvider, refresh_token, now -> MintResult``);
the minter is injectable so ``get_access_token`` stays unit-testable offline.

The IMAP/SMTP layer asks for a fresh access token on each connect; this refreshes
transparently. A dead refresh token surfaces as ``permission_denied`` with
``action: reauthorize`` — the UI turns that into a one-click Reconnect, never a
silent retry loop.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import timezone
from typing import Any, Callable

from utils.apps.mailbox.backend.services.oauth.registry import OAuthProvider, get_provider
from utils.apps.mailbox.shared.errors import PermissionDeniedError

SKEW_SECONDS = 60

# account_id -> (access_token, expiry_epoch). Process-local cache.
_CACHE: dict[str, tuple[str, float]] = {}


@dataclass(frozen=True)
class MintResult:
    access_token: str
    expiry: float                       # epoch seconds
    refresh_token: str | None = None    # rotated refresh token, if the provider issued one


Minter = Callable[[OAuthProvider, str, float], MintResult]


def _resource_scopes(provider: OAuthProvider) -> list[str]:
    """The libraries want the resource (http) scopes; openid/email/offline_access
    are reserved and added automatically."""
    return [s for s in provider.scopes if s.startswith("http")]


# --- per-provider minters (official libraries) --------------------------------

def _google_minter(provider: OAuthProvider, refresh_token: str, now: float, *, request=None) -> MintResult:
    """Refresh a Gmail access token via ``google-auth``. ``request`` (a
    ``google.auth.transport`` callable) is injectable for offline tests."""
    from google.auth.exceptions import GoogleAuthError
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=provider.token_url,
        client_id=provider.client_id,
        client_secret=provider.client_secret,
        scopes=_resource_scopes(provider),
    )
    try:
        creds.refresh(request or Request())
    except GoogleAuthError as exc:  # includes RefreshError on invalid_grant
        raise PermissionDeniedError(
            "gmail token refresh failed; reconnect the account",
            details={"error": str(exc), "action": "reauthorize"},
        ) from exc
    expiry = (
        creds.expiry.replace(tzinfo=timezone.utc).timestamp()
        if creds.expiry
        else now + 3600
    )
    # google-auth does not rotate the refresh token.
    return MintResult(creds.token, expiry)


def _msal_minter(provider: OAuthProvider, refresh_token: str, now: float, *, http_client=None) -> MintResult:
    """Refresh an M365 access token via ``msal``. ``http_client`` is injectable
    for offline tests; ``instance_discovery=False`` avoids an extra metadata call."""
    import msal

    authority = "https://login.microsoftonline.com/common"
    kwargs: dict[str, Any] = {"authority": authority, "instance_discovery": False}
    if http_client is not None:
        kwargs["http_client"] = http_client
    if provider.client_secret:
        app = msal.ConfidentialClientApplication(
            provider.client_id, client_credential=provider.client_secret, **kwargs
        )
    else:
        app = msal.PublicClientApplication(provider.client_id, **kwargs)

    result = app.acquire_token_by_refresh_token(refresh_token, scopes=_resource_scopes(provider))
    if "access_token" not in result:
        raise PermissionDeniedError(
            "m365 token refresh failed; reconnect the account",
            details={
                "error": result.get("error"),
                "error_description": result.get("error_description"),
                "action": "reauthorize",
            },
        )
    expiry = now + int(result.get("expires_in", 3600))
    return MintResult(result["access_token"], expiry, result.get("refresh_token"))


def _minter_for(provider: str) -> Minter:
    if provider == "gmail":
        return _google_minter
    if provider == "m365":
        return _msal_minter
    raise PermissionDeniedError(
        f"no OAuth minter for provider '{provider}'",
        details={"provider": provider, "action": "reauthorize"},
    )


# --- the public seam ----------------------------------------------------------

def get_access_token(
    account: Any,
    *,
    get_refresh: Callable[[str], Any],
    set_refresh: Callable[[str, Any], None] | None = None,
    now: float | None = None,
    cache: dict[str, tuple[str, float]] | None = None,
    provider_config: OAuthProvider | None = None,
    minter: Minter | None = None,
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

    provider = provider_config or get_provider(account.provider)
    mint = minter or _minter_for(account.provider)
    result = mint(provider, refresh, ts)  # raises permission_denied on failure

    cache[account.id] = (result.access_token, result.expiry)
    if result.refresh_token and set_refresh is not None:
        set_refresh(account.credential_ref, result.refresh_token)
    return result.access_token
