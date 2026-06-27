"""Mailbox read path: list and open messages (standalone, testable).

Relocated from the standalone ``mailbox_sync.py``. The connection account and
IMAP auth now come from ``ops`` (one ``MailAccount`` shape across read + write),
and the IMAP seam is injectable so the core is unit-testable with no live
connection.

- ``parse_rfc822`` is a pure ``bytes -> MessageDTO`` function.
- ``list_messages`` returns the most recent messages in a folder (newest first),
  keyed by real IMAP UID so the organize op can MOVE them afterwards.
- ``get_message`` fetches one message with its decoded text/HTML body, for the
  inbox "open the email" view.

Messages are normalized to :class:`MessageDTO`. Read-only and non-interactive;
missing credentials raise a typed ``PermissionDeniedError`` (never a prompt).
"""

from __future__ import annotations

import email
import re
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Iterable

from utils.apps.mailbox.backend.services import ops
from utils.apps.mailbox.backend.services.ops import ImapLike, MailAccount
from utils.apps.mailbox.shared.errors import ValidationError
from utils.apps.mailbox.shared.schemas import MessageDTO

_FLAGS_RE = re.compile(rb"FLAGS \(([^)]*)\)", re.IGNORECASE)


# --- parsing helpers ----------------------------------------------------------

def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _part_text(part: email.message.Message) -> str:
    try:
        payload = part.get_payload(decode=True) or b""
        return payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    except Exception:
        return ""


def _extract_bodies(msg: email.message.Message) -> tuple[str, str]:
    """Return (plain_text, html) bodies, walking multipart messages."""
    text = ""
    html = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if "attachment" in str(part.get("Content-Disposition", "")).lower():
                continue
            ctype = part.get_content_type()
            if ctype == "text/plain" and not text:
                text = _part_text(part)
            elif ctype == "text/html" and not html:
                html = _part_text(part)
    else:
        body = _part_text(msg)
        if msg.get_content_type() == "text/html":
            html = body
        else:
            text = body
    return text, html


def _snippet(text: str, limit: int = 200) -> str:
    return " ".join(text.split())[:limit]


def _timestamp(date_str: str | None) -> float:
    """Parse an RFC-2822 ``Date`` header to epoch seconds for sorting.

    Returns ``0.0`` when the header is missing or unparseable, so a bad date
    sorts to the bottom rather than raising.
    """
    if not date_str:
        return 0.0
    try:
        dt = parsedate_to_datetime(date_str)
    except (TypeError, ValueError):
        return 0.0
    if dt is None:
        return 0.0
    try:
        return dt.timestamp()
    except (OverflowError, OSError, ValueError):
        return 0.0


def parse_rfc822(
    raw: bytes,
    *,
    uid: str,
    provider: str,
    account: str,
    flags: Iterable[str] = (),
    with_body: bool = False,
) -> MessageDTO:
    """Pure function: bytes -> MessageDTO. Fully unit-testable, no network."""
    msg = email.message_from_bytes(raw)
    text, html = _extract_bodies(msg)
    date = _decode(msg.get("Date"))
    return MessageDTO(
        uid=uid,
        provider=provider,
        account=account,
        subject=_decode(msg.get("Subject")),
        from_addr=_decode(msg.get("From")),
        to_addr=_decode(msg.get("To")),
        date=date,
        snippet=_snippet(text or html),
        timestamp=_timestamp(msg.get("Date")),
        message_id=_decode(msg.get("Message-ID")),
        flags=list(flags),
        body_text=text if with_body else None,
        body_html=html if with_body else None,
    )


def _parse_flags(envelope: bytes | str | None) -> list[str]:
    if not envelope:
        return []
    raw = envelope if isinstance(envelope, bytes) else str(envelope).encode()
    match = _FLAGS_RE.search(raw)
    if not match:
        return []
    return [f.decode() if isinstance(f, bytes) else f for f in match.group(1).split()]


def _split_fetch(item: Any) -> tuple[bytes, bytes] | None:
    """A FETCH response row is ``(envelope_bytes, raw_bytes)``; trailing ``b')'``
    rows are skipped."""
    if isinstance(item, (tuple, list)) and len(item) >= 2:
        return item[0], item[1]
    return None


# --- the read entrypoints -----------------------------------------------------

def list_messages(
    account: MailAccount,
    *,
    folder: str = "INBOX",
    limit: int | None = 25,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> list[MessageDTO]:
    """Fetch messages from ``folder`` (newest first).

    ``limit`` caps the count to the most recent N; pass ``None`` to fetch *all*
    messages in the folder. Read-only. UID-keyed so the returned ``uid`` can be
    handed to organize.
    """
    if limit is not None and limit < 1:
        raise ValidationError("limit must be >= 1", details={"limit": limit})

    client = ops.connect_imap(account, imap_factory=imap_factory)
    try:
        client.select(folder, readonly=True)
        typ, data = client.uid("SEARCH", "ALL")
        ids = (data[0].split() if data and data[0] else [])
        recent = ids if limit is None else ids[-limit:]
        out: list[MessageDTO] = []
        for raw_id in reversed(recent):  # newest first
            uid = raw_id.decode() if isinstance(raw_id, bytes) else str(raw_id)
            typ, fetched = client.uid("FETCH", uid, "(FLAGS RFC822)")
            if not fetched or not fetched[0]:
                continue
            split = _split_fetch(fetched[0])
            if not split:
                continue
            envelope, raw_bytes = split
            out.append(
                parse_rfc822(
                    raw_bytes,
                    uid=uid,
                    provider=account.provider,
                    account=account.email,
                    flags=_parse_flags(envelope),
                )
            )
        return out
    finally:
        ops._safe_logout(client)


def get_message(
    account: MailAccount,
    *,
    uid: str,
    folder: str = "INBOX",
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> MessageDTO:
    """Fetch a single message (by UID) with its decoded text/HTML body."""
    if not uid:
        raise ValidationError("uid is required", details={"uid": uid})

    client = ops.connect_imap(account, imap_factory=imap_factory)
    try:
        client.select(folder, readonly=True)
        typ, fetched = client.uid("FETCH", uid, "(FLAGS RFC822)")
        if not fetched or not fetched[0] or not _split_fetch(fetched[0]):
            from utils.apps.mailbox.shared.errors import NotFoundError

            raise NotFoundError(
                f"message {uid} not found in {folder}",
                details={"uid": uid, "folder": folder},
            )
        envelope, raw_bytes = _split_fetch(fetched[0])  # type: ignore[misc]
        return parse_rfc822(
            raw_bytes,
            uid=uid,
            provider=account.provider,
            account=account.email,
            flags=_parse_flags(envelope),
            with_body=True,
        )
    finally:
        ops._safe_logout(client)


# --- self-test (no network) ---------------------------------------------------

def _selftest() -> None:
    raw = (
        b"From: Alice <alice@example.com>\r\n"
        b"To: bob@example.com\r\n"
        b"Subject: Hello =?utf-8?q?=E2=9C=93?=\r\n"
        b"Message-ID: <abc123@example.com>\r\n"
        b"Date: Mon, 22 Jun 2026 09:00:00 +0000\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
        b"This is the body of the message.\r\n"
    )

    # 1. parse_rfc822 is pure and correct (subject decode, message-id, snippet)
    dto = parse_rfc822(raw, uid="42", provider="yahoo", account="bob@example.com",
                       flags=["\\Seen"], with_body=True)
    assert dto.subject == "Hello ✓", dto.subject
    assert dto.from_addr == "Alice <alice@example.com>"
    assert dto.message_id == "<abc123@example.com>"
    assert dto.snippet.startswith("This is the body")
    assert dto.body_text.startswith("This is the body")
    assert dto.unread is False  # \\Seen present
    assert dto.timestamp > 0  # Date header parsed to epoch seconds

    class FakeImap:
        def __init__(self): self.selected = None
        def authenticate(self, mech, fn): fn(b"")
        def login(self, u, p): pass
        def select(self, mb, readonly=False): self.selected = mb; return ("OK", [b"2"])
        def uid(self, cmd, *args):
            if cmd == "SEARCH":
                return ("OK", [b"1 2"])
            if cmd == "FETCH":
                return ("OK", [(b"%s (UID %s FLAGS () RFC822 {%d}"
                                % (args[0].encode(), args[0].encode(), len(raw)), raw), b")"])
            return ("OK", [b"ok"])
        def logout(self): pass

    acct = MailAccount("yahoo", "bob@example.com", "imap.mail.yahoo.com", 993,
                       "smtp.mail.yahoo.com", 587, "password", app_password="apppw")

    # 2. list_messages returns newest-first, UID-keyed, unread by default
    msgs = list_messages(acct, imap_factory=lambda a: FakeImap())
    assert len(msgs) == 2
    assert msgs[0].uid == "2"  # newest first
    assert msgs[0].unread is True  # no \\Seen
    assert msgs[0].subject == "Hello ✓"

    # 3. get_message returns a decoded body
    one = get_message(acct, uid="2", imap_factory=lambda a: FakeImap())
    assert one.body_text.startswith("This is the body")

    # 4. missing creds -> typed permission error, never a prompt
    from utils.apps.mailbox.shared.errors import PermissionDeniedError

    try:
        list_messages(
            MailAccount("gmail", "x@gmail.com", "imap.gmail.com", 993,
                        "smtp.gmail.com", 587, "oauth2"),
            imap_factory=lambda a: FakeImap(),
        )
        raise AssertionError("expected PermissionDeniedError")
    except PermissionDeniedError as exc:
        assert exc.details["missing"] == "access_token"

    print("mailbox sync selftest OK — all assertions passed")


if __name__ == "__main__":
    _selftest()
