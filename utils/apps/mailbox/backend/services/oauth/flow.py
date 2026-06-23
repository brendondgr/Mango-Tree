"""The portal flow: build the authorize URL, exchange the returned code for
tokens, read the authoritative email, and register the account.

Network calls go through injectable ``transport`` seams so the whole flow is
unit-testable offline. Only the refresh token is persisted (in the secret store);
the email is read from the verified ``id_token``/userinfo, never typed by the user.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from typing import Any, Callable
from urllib.parse import urlencode

from utils.apps.mailbox.backend.services.oauth import transport as _transport
from utils.apps.mailbox.backend.services.oauth.pkce import (
    challenge_for,
    new_state,
    new_verifier,
)
from utils.apps.mailbox.backend.services.oauth.registry import OAuthProvider, get_provider
from utils.apps.mailbox.shared.errors import PermissionDeniedError, ProviderError

PostTransport = Callable[[str, dict[str, str]], tuple[int, Any]]
UserinfoTransport = Callable[[str, str], tuple[int, Any]]


def _provider(provider: str, provider_config: OAuthProvider | None) -> OAuthProvider:
    return provider_config or get_provider(provider)


def build_authorize_url(
    provider: str,
    redirect_uri: str,
    pending_store: Any,
    *,
    provider_config: OAuthProvider | None = None,
    verifier: str | None = None,
    state: str | None = None,
) -> str:
    """Build the provider's authorize URL and record the pending attempt."""
    p = _provider(provider, provider_config)
    verifier = verifier or new_verifier()
    state = state or new_state()
    pending_store.put(
        state,
        {"provider": provider, "verifier": verifier, "redirect_uri": redirect_uri},
        ttl_seconds=600,
    )
    params = {
        "client_id": p.client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": " ".join(p.scopes),
        "state": state,
        "code_challenge": challenge_for(verifier),
        "code_challenge_method": "S256",
        **p.extra_authorize_params,
    }
    return f"{p.authorize_url}?{urlencode(params)}"


def exchange_code(
    provider: str,
    code: str,
    verifier: str,
    redirect_uri: str,
    *,
    provider_config: OAuthProvider | None = None,
    transport: PostTransport | None = None,
) -> dict[str, Any]:
    """Exchange the authorization code for tokens at the token endpoint."""
    p = _provider(provider, provider_config)
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": p.client_id,
        "code_verifier": verifier,
    }
    if p.client_secret:
        data["client_secret"] = p.client_secret
    status, body = (transport or _transport.post_form)(p.token_url, data)
    body = body if isinstance(body, dict) else {}
    if status >= 400:
        raise PermissionDeniedError(
            "OAuth token exchange failed",
            details={"status": status, "error": body.get("error"), "action": "reauthorize"},
        )
    return body


def _decode_jwt_email(id_token: str) -> str | None:
    try:
        payload_b64 = id_token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
    except (IndexError, ValueError, binascii.Error, json.JSONDecodeError):
        return None
    for key in ("email", "preferred_username", "upn"):
        value = claims.get(key)
        if isinstance(value, str) and "@" in value:
            return value
    return None


def read_email(
    provider: str,
    token_response: dict[str, Any],
    *,
    provider_config: OAuthProvider | None = None,
    userinfo_transport: UserinfoTransport | None = None,
) -> str:
    """Determine the account's email from the verified id_token, else userinfo."""
    p = _provider(provider, provider_config)
    id_token = token_response.get("id_token")
    if id_token:
        email = _decode_jwt_email(id_token)
        if email:
            return email
    if p.userinfo_url and token_response.get("access_token"):
        status, body = (userinfo_transport or _transport.get_bearer)(
            p.userinfo_url, token_response["access_token"]
        )
        if status < 400 and isinstance(body, dict) and isinstance(body.get("email"), str):
            return body["email"]
    raise ProviderError(
        "could not determine the account email from the OAuth response",
        details={"provider": provider},
    )


def _slug(email: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", email).strip("_").upper()


def _account_id(provider: str, email: str) -> str:
    digest = hashlib.sha1(f"{provider}:{email.lower()}".encode()).hexdigest()[:12]
    return f"acc_{digest}"


def register_account(
    provider: str,
    email: str,
    refresh_token: str,
    *,
    config_store: Any,
    secrets: Any,
) -> dict[str, Any]:
    """Persist the refresh token and upsert the account (idempotent per email)."""
    from utils.apps.mailbox.shared.errors import NotFoundError

    account_id = _account_id(provider, email)
    cred_ref = f"MAIL_{provider.upper()}_{_slug(email)}_REFRESH"
    secrets.set_credential(cred_ref, refresh_token)

    try:
        display_name = config_store.get_account(account_id).display_name
    except NotFoundError:
        display_name = email.split("@")[0]

    account = config_store.save_account({
        "id": account_id,
        "provider": provider,
        "display_name": display_name,
        "email": email,
        "enabled": True,
        "status": "ok",
        "credential_ref": cred_ref,
    })
    return account.to_dict()


def complete_login(
    state_data: dict[str, Any],
    code: str,
    *,
    config_store: Any,
    secrets: Any,
    transport: PostTransport | None = None,
    userinfo_transport: UserinfoTransport | None = None,
    provider_config: OAuthProvider | None = None,
) -> dict[str, Any]:
    """Exchange the code, read the email, store the refresh token, upsert account."""
    provider = state_data["provider"]
    tokens = exchange_code(
        provider, code, state_data["verifier"], state_data["redirect_uri"],
        provider_config=provider_config, transport=transport,
    )
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise PermissionDeniedError(
            "the provider returned no refresh token; ensure offline access and consent",
            details={"action": "reauthorize"},
        )
    email = read_email(
        provider, tokens, provider_config=provider_config, userinfo_transport=userinfo_transport
    )
    return register_account(provider, email, refresh_token, config_store=config_store, secrets=secrets)
