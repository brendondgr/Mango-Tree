"""Microsoft Exchange (on-premises) mailbox operations.

Scope: on-prem Exchange Server, NOT affected by the Exchange Online
deprecations — EWS and basic auth continue to work on-prem, and host/ports are
organization-specific. For Exchange Online (cloud) mailboxes use ``m365``.

Auth: either basic auth (username + app/account password) or OAuth2. The account
is ``auth="either"`` so a token is preferred when present, otherwise the password
is used.

In the app, accounts are resolved from the config store via the provider
registry; ``build_account()`` here reads ``MAIL_EXCHANGE_*`` env vars for
standalone/debug use only.

ORGANIZE: Exchange IMAP historically does NOT support MOVE reliably, so the
account sets ``supports_move=False`` to force the core's COPY + STORE \\Deleted +
EXPUNGE fallback (supported by every server).
SEND: SMTP on the server's submission port + STARTTLS; basic or XOAUTH2.
TREE: IMAP LIST returns the mailbox tree; the core honors the reported delimiter.
"""

from __future__ import annotations

import os
from typing import Any

from utils.apps.mailbox.backend.services.ops import (
    MailAccount,
    PermissionDeniedError,
    ValidationError,
    folder_tree as _folder_tree,
    organize_message as _organize_message,
    send_message as _send_message,
)


def build_account() -> MailAccount:
    addr = os.environ.get("MAIL_EXCHANGE_EMAIL")
    imap_host = os.environ.get("MAIL_EXCHANGE_IMAP_HOST")
    if not addr:
        raise PermissionDeniedError("set MAIL_EXCHANGE_EMAIL", details={"missing": "email"})
    if not imap_host:
        raise ValidationError(
            "set MAIL_EXCHANGE_IMAP_HOST (on-prem host is organization-specific)",
            details={"missing": "imap_host"},
        )
    app_pw = os.environ.get("MAIL_EXCHANGE_APP_PASSWORD")
    token = os.environ.get("MAIL_EXCHANGE_ACCESS_TOKEN")
    if not (app_pw or token):
        raise PermissionDeniedError(
            "Exchange needs MAIL_EXCHANGE_APP_PASSWORD or MAIL_EXCHANGE_ACCESS_TOKEN",
            details={"missing": "credentials"},
        )
    return MailAccount(
        provider="exchange",
        email=addr,
        imap_host=imap_host,
        imap_port=int(os.environ.get("MAIL_EXCHANGE_IMAP_PORT", "993")),
        smtp_host=os.environ.get("MAIL_EXCHANGE_SMTP_HOST", imap_host),
        smtp_port=int(os.environ.get("MAIL_EXCHANGE_SMTP_PORT", "587")),
        auth="either",
        app_password=app_pw,
        access_token=token,
        supports_move=False,       # force COPY+EXPUNGE fallback for Exchange IMAP
        folder_delimiter="/",
    )


def organize(uid: str, *, source: str = "INBOX", dest: str, **kw: Any) -> dict[str, Any]:
    return _organize_message(build_account(), uid=uid, source_folder=source,
                             dest_folder=dest, **kw)


def send(to: list[str], subject: str, body: str, **kw: Any) -> dict[str, Any]:
    return _send_message(build_account(), to=to, subject=subject, body=body, **kw)


def tree(**kw: Any) -> dict[str, Any]:
    return _folder_tree(build_account(), **kw)


if __name__ == "__main__":
    import json
    print(json.dumps(tree(), indent=2))
