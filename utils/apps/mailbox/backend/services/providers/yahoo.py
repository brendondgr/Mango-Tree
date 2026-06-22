"""Yahoo Mail mailbox operations (per-provider notes + standalone env wrappers).

Auth: app password (basic auth over IMAP/SMTP). Yahoo is not part of the
Microsoft/Google Basic-auth deprecations, so generate an app password in Yahoo
Account Security and use it directly. This makes Yahoo the easiest provider to
validate the whole pipeline against first.

In the app, accounts are resolved from the config store via the provider
registry; ``build_account()`` here reads ``MAIL_YAHOO_*`` env vars for
standalone/debug use only.

ORGANIZE: real IMAP folders, advertises MOVE -> true ``UID MOVE``.
SEND: SMTP smtp.mail.yahoo.com:587 + STARTTLS, AUTH LOGIN with the app password.
TREE: IMAP LIST returns Inbox/Sent/Draft/Trash/Bulk + custom folders.
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
    addr = os.environ.get("MAIL_YAHOO_EMAIL")
    app_pw = os.environ.get("MAIL_YAHOO_APP_PASSWORD")
    if not addr:
        raise PermissionDeniedError("set MAIL_YAHOO_EMAIL", details={"missing": "email"})
    if not app_pw:
        raise PermissionDeniedError(
            "Yahoo requires an app password",
            details={"missing": "app_password"},
        )
    return MailAccount(
        provider="yahoo",
        email=addr,
        imap_host="imap.mail.yahoo.com",
        imap_port=993,
        smtp_host="smtp.mail.yahoo.com",
        smtp_port=587,
        auth="password",
        app_password=app_pw,
        supports_move=True,        # Yahoo IMAP supports MOVE
        folder_delimiter="/",
    )


def organize(uid: str, *, source: str = "Inbox", dest: str, **kw: Any) -> dict[str, Any]:
    return _organize_message(build_account(), uid=uid, source_folder=source,
                             dest_folder=dest, **kw)


def send(to: list[str], subject: str, body: str, **kw: Any) -> dict[str, Any]:
    return _send_message(build_account(), to=to, subject=subject, body=body, **kw)


def tree(**kw: Any) -> dict[str, Any]:
    return _folder_tree(build_account(), **kw)


if __name__ == "__main__":
    import json
    print(json.dumps(tree(), indent=2))
