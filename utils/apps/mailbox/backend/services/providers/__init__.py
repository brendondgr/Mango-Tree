"""Provider registry: resolve an account id -> a connection ``MailAccount``.

The config store is the authoritative account list. ``build_account`` reads an
account's *settings* from the config store and its credential from the secret
store (keyed by ``credential_ref``), then assembles the per-provider
``MailAccount`` that ops/sync connect with. Env vars are never consulted here —
the per-provider modules' env ``build_account()`` helpers are standalone/debug
only.

Account scoping (D1): there is no free-form ``account`` — every read/mutation
resolves an id against the config store via this registry, so a caller can only
touch accounts that exist there.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

from utils.apps.mailbox.backend.services import oauth as _oauth
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.errors import MailError, ValidationError
from utils.apps.mailbox.shared.schemas import AccountConfig


@dataclass(frozen=True)
class ProviderDefaults:
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    auth: str            # "oauth2" | "password" | "either"
    supports_move: bool


# Per-provider connection defaults. Exchange (on-prem) has no defaults — host
# comes from the account settings.
PROVIDERS: dict[str, ProviderDefaults] = {
    "gmail": ProviderDefaults("imap.gmail.com", 993, "smtp.gmail.com", 587, "oauth2", True),
    "m365": ProviderDefaults("outlook.office365.com", 993, "smtp.office365.com", 587, "oauth2", True),
    "yahoo": ProviderDefaults("imap.mail.yahoo.com", 993, "smtp.mail.yahoo.com", 587, "password", True),
    "exchange": ProviderDefaults("", 993, "", 587, "either", False),
}


def build_account_from_config(
    account: AccountConfig,
    *,
    get_secret: Callable[[str], Any] | None = None,
    transport: _oauth.Transport | None = None,
    now: float | None = None,
    on_refresh: Callable[[dict[str, Any]], None] | None = None,
) -> MailAccount:
    """Assemble a connection ``MailAccount`` from persisted settings + secret.

    ``get_secret`` resolves ``credential_ref`` -> the stored secret: a plain
    app-password string, or an OAuth bundle dict. For OAuth providers the bundle's
    refresh token is exchanged for a short-lived access token (cached via
    ``on_refresh``); ``transport``/``now`` are injectable for offline tests. When
    no credential is present the account is built without one and ``connect_imap``
    raises ``permission_denied``.
    """
    if account.provider not in PROVIDERS:
        raise ValidationError(
            f"unknown provider '{account.provider}'",
            details={"field": "provider", "valid": list(PROVIDERS)},
        )
    defaults = PROVIDERS[account.provider]

    secret: Any = None
    if account.credential_ref and get_secret is not None:
        secret = get_secret(account.credential_ref)

    auth = defaults.auth
    access_token: str | None = None
    app_password: str | None = None
    if secret is not None:
        if auth == "oauth2":
            bundle = secret if isinstance(secret, dict) else {"access_token": secret}
            access_token = _oauth.resolve_access_token(
                account.provider,
                bundle,
                now=now if now is not None else time.time(),
                transport=transport,
                on_refresh=on_refresh,
            )
        else:  # password / either (app-password basic auth)
            app_password = secret if isinstance(secret, str) else secret.get("app_password")

    imap_host = account.imap_host or defaults.imap_host
    smtp_host = account.smtp_host or defaults.smtp_host or imap_host
    return MailAccount(
        provider=account.provider,
        email=account.email,
        imap_host=imap_host,
        imap_port=account.imap_port or defaults.imap_port,
        smtp_host=smtp_host,
        smtp_port=account.smtp_port or defaults.smtp_port,
        auth=auth,
        app_password=app_password,
        access_token=access_token,
        supports_move=defaults.supports_move,
    )


def _writeback(secrets_mod: Any, ref: str | None) -> Callable[[dict[str, Any]], None] | None:
    """A callback that caches a refreshed OAuth bundle back into the secret store."""
    if not ref:
        return None
    return lambda updated: secrets_mod.set_credential(ref, updated)


def build_account(
    account_id: str,
    *,
    config: Any = None,
    secret_store: Any = None,
    transport: _oauth.Transport | None = None,
    now: float | None = None,
) -> MailAccount:
    """Resolve an account id to a connection ``MailAccount`` (settings + secret),
    minting/refreshing the OAuth access token on demand and caching it back."""
    from utils.apps.mailbox.backend.services import config_store, secrets

    cfg_mod = config or config_store
    sec_mod = secret_store or secrets
    account = cfg_mod.get_account(account_id)  # raises NotFoundError when absent
    return build_account_from_config(
        account,
        get_secret=sec_mod.get_credential,
        transport=transport,
        now=now,
        on_refresh=_writeback(sec_mod, account.credential_ref),
    )


def test_account(
    account_id: str,
    *,
    config: Any = None,
    secret_store: Any = None,
    transport: _oauth.Transport | None = None,
    imap_factory: Callable[[MailAccount], Any] | None = None,
) -> dict[str, Any]:
    """Open and close an IMAP connection to verify the account, then persist the
    result as the account's ``status``. Connection failures (including a dead
    refresh token) are an expected test outcome (``status="error"``), not an
    exception; an unknown id still 404s."""
    from utils.apps.mailbox.backend.services import config_store, ops, secrets

    cfg_mod = config or config_store
    sec_mod = secret_store or secrets
    account = cfg_mod.get_account(account_id)  # NotFoundError propagates -> 404
    try:
        acct = build_account_from_config(
            account,
            get_secret=sec_mod.get_credential,
            transport=transport,
            on_refresh=_writeback(sec_mod, account.credential_ref),
        )
        client = ops.connect_imap(acct, imap_factory=imap_factory)
        ops._safe_logout(client)
    except MailError as exc:
        cfg_mod.set_status(account_id, "error")
        return {"id": account_id, "status": "error", "ok": False,
                "code": exc.code, "message": exc.message}
    cfg_mod.set_status(account_id, "ok")
    return {"id": account_id, "status": "ok", "ok": True}
