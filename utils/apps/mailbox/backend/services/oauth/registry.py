"""OAuth client registry: per-provider endpoints, scopes, and the app's own
client credentials (from the environment, never hardcoded).

You register one OAuth app per provider once (Google Cloud / Microsoft Entra),
then set the client id/secret in the environment. Public/desktop clients use
PKCE with no secret (``client_secret`` stays ``None``). See
``utils/apps/mailbox/README.md`` for the one-time setup.

Yahoo is intentionally absent — its IMAP OAuth is not self-serve, so Yahoo
accounts use an app password. On-prem Exchange OAuth (modern auth) is built
per-account from org-supplied endpoints and is not in this fixed registry.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from utils.apps.mailbox.shared.errors import PermissionDeniedError, ValidationError


@dataclass(frozen=True)
class OAuthProvider:
    name: str
    authorize_url: str
    token_url: str
    scopes: list[str]
    client_id: str
    client_secret: str | None = None       # None for public/PKCE-only clients
    userinfo_url: str | None = None         # to read the authoritative email
    extra_authorize_params: dict = field(default_factory=dict)


def _env(key: str) -> str | None:
    value = os.environ.get(key)
    return value or None


def _providers() -> dict[str, OAuthProvider]:
    """Built fresh from the environment so tests / runtime can set client creds
    without re-importing the module."""
    return {
        "gmail": OAuthProvider(
            name="gmail",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            scopes=["https://mail.google.com/", "openid", "email"],
            client_id=_env("OAUTH_GMAIL_CLIENT_ID") or "",
            client_secret=_env("OAUTH_GMAIL_CLIENT_SECRET"),
            userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
            # Google only returns a refresh token with offline access + forced consent.
            extra_authorize_params={"access_type": "offline", "prompt": "consent"},
        ),
        "m365": OAuthProvider(
            name="m365",
            authorize_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scopes=[
                "https://outlook.office.com/IMAP.AccessAsUser.All",
                "https://outlook.office.com/SMTP.Send",
                "offline_access",
                "openid",
                "email",
            ],
            client_id=_env("OAUTH_M365_CLIENT_ID") or "",
            client_secret=_env("OAUTH_M365_CLIENT_SECRET"),
            userinfo_url=None,  # email comes from the id_token
            extra_authorize_params={},
        ),
    }


def supports_oauth(provider: str) -> bool:
    return provider in _providers()


def get_provider(provider: str) -> OAuthProvider:
    """Resolve a configured OAuth provider, or raise a clear, typed error."""
    registry = _providers()
    if provider not in registry:
        raise ValidationError(
            f"{provider} does not support OAuth portal login",
            details={"provider": provider, "supported": sorted(registry)},
        )
    entry = registry[provider]
    if not entry.client_id:
        raise PermissionDeniedError(
            f"OAuth is not configured for {provider}: set OAUTH_{provider.upper()}_CLIENT_ID"
            f" (and OAUTH_{provider.upper()}_CLIENT_SECRET)",
            details={"missing": "client_id", "provider": provider},
        )
    return entry
