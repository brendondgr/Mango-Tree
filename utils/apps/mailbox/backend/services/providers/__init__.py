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

from dataclasses import dataclass
from typing import Any, Callable

from utils.apps.mailbox.backend.services.oauth import tokens as _tokens
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
    set_secret: Callable[[str, Any], None] | None = None,
    minter: _tokens.Minter | None = None,
    now: float | None = None,
    cache: dict[str, tuple[str, float]] | None = None,
    provider_config: Any = None,
) -> MailAccount:
    """Assemble a connection ``MailAccount`` from persisted settings + secret.

    For OAuth providers (Gmail/M365) the stored secret is a *refresh token*; it is
    exchanged for a short-lived access token via ``tokens.get_access_token``
    (cached in-process; a rotated refresh token is written back through
    ``set_secret``). App-password providers (Yahoo/Exchange) use the stored string
    directly. ``transport``/``now``/``cache``/``provider_config`` are injectable for
    offline tests. With no credential the account is built without one and
    ``connect_imap`` raises ``permission_denied``.
    """
    if account.provider not in PROVIDERS:
        raise ValidationError(
            f"unknown provider '{account.provider}'",
            details={"field": "provider", "valid": list(PROVIDERS)},
        )
    defaults = PROVIDERS[account.provider]

    auth = defaults.auth
    access_token: str | None = None
    app_password: str | None = None
    if account.credential_ref and get_secret is not None:
        if auth == "oauth2":
            access_token = _tokens.get_access_token(
                account,
                get_refresh=get_secret,
                set_refresh=set_secret,
                minter=minter,
                now=now,
                cache=cache,
                provider_config=provider_config,
            )
        else:  # password / either (app-password basic auth)
            secret = get_secret(account.credential_ref)
            app_password = secret if isinstance(secret, str) else (
                secret.get("app_password") if isinstance(secret, dict) else None
            )

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


def build_account(
    account_id: str,
    *,
    config: Any = None,
    secret_store: Any = None,
    minter: _tokens.Minter | None = None,
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
        set_secret=sec_mod.set_credential,
        minter=minter,
        now=now,
    )


def test_account(
    account_id: str,
    *,
    config: Any = None,
    secret_store: Any = None,
    minter: _tokens.Minter | None = None,
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
            set_secret=sec_mod.set_credential,
            minter=minter,
        )
        client = ops.connect_imap(acct, imap_factory=imap_factory)
        ops._safe_logout(client)
    except MailError as exc:
        cfg_mod.set_status(account_id, "error")
        return {"id": account_id, "status": "error", "ok": False,
                "code": exc.code, "message": exc.message}
    cfg_mod.set_status(account_id, "ok")
    return {"id": account_id, "status": "ok", "ok": True}
