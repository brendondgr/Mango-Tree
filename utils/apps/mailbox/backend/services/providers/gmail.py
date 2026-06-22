"""Gmail mailbox operations (per-provider notes + standalone env wrappers).

Auth (current as of mid-2026): OAuth2 only. Google disabled Basic Auth / app
passwords for IMAP on 2025-03-14, so a bearer access token is mandatory.
Register an OAuth client and request scope ``https://mail.google.com/`` for full
IMAP/SMTP access.

In the app, accounts are resolved from the config store via the provider
registry (``services/providers/__init__.py``); the ``build_account()`` here reads
``MAIL_GMAIL_*`` env vars and exists only for standalone/debug use.

ORGANIZE: Gmail has *labels*, not folders. Over IMAP a label is a folder and
``UID MOVE`` works, but the semantics are label-based — moving to "Work" removes
the INBOX label and adds Work; the message still lives under "[Gmail]/All Mail".
SEND: SMTP smtp.gmail.com:587 + STARTTLS + XOAUTH2; Gmail files a Sent copy.
TREE: IMAP LIST nests labels by "/"; the "[Gmail]" container is \\Noselect.
"""

from __future__ import annotations

import os
from typing import Any

from utils.apps.mailbox.backend.services.ops import (
    MailAccount,
    PermissionDeniedError,
    folder_tree as _folder_tree,
    organize_message as _organize_message,
    send_message as _send_message,
)


def build_account() -> MailAccount:
    addr = os.environ.get("MAIL_GMAIL_EMAIL")
    token = os.environ.get("MAIL_GMAIL_ACCESS_TOKEN")
    if not addr:
        raise PermissionDeniedError("set MAIL_GMAIL_EMAIL", details={"missing": "email"})
    if not token:
        raise PermissionDeniedError(
            "Gmail requires an OAuth2 access token (Basic auth removed 2025-03-14)",
            details={"missing": "access_token"},
        )
    return MailAccount(
        provider="gmail",
        email=addr,
        imap_host="imap.gmail.com",
        imap_port=993,
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        auth="oauth2",
        access_token=token,
        supports_move=True,        # Gmail IMAP supports MOVE
        folder_delimiter="/",
    )


def organize(uid: str, *, source: str = "INBOX", dest: str, **kw: Any) -> dict[str, Any]:
    """Apply label `dest` and remove `source` (Gmail label-move semantics)."""
    return _organize_message(build_account(), uid=uid, source_folder=source,
                             dest_folder=dest, **kw)


def send(to: list[str], subject: str, body: str, **kw: Any) -> dict[str, Any]:
    return _send_message(build_account(), to=to, subject=subject, body=body, **kw)


def tree(**kw: Any) -> dict[str, Any]:
    return _folder_tree(build_account(), **kw)


if __name__ == "__main__":
    import json
    print(json.dumps(tree(), indent=2))
