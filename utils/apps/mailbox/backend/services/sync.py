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
import time
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Iterable

from utils.apps.mailbox.backend.services import cache as _cache
from utils.apps.mailbox.backend.services import ops
from utils.apps.mailbox.backend.services.ops import ImapLike, MailAccount
from utils.apps.mailbox.shared.errors import ValidationError
from utils.apps.mailbox.shared.schemas import MessageDTO

_FLAGS_RE = re.compile(rb"FLAGS \(([^)]*)\)", re.IGNORECASE)
_UID_RE = re.compile(rb"UID\s+(\d+)", re.IGNORECASE)
_UIDVALIDITY_RE = re.compile(rb"UIDVALIDITY\s+(\d+)", re.IGNORECASE)


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


# --- incremental sync (cache-backed) ------------------------------------------

def _decode_uid(value: Any) -> str:
    return value.decode() if isinstance(value, bytes) else str(value)


def _uid_sort_key(uid: str) -> int:
    try:
        return int(uid)
    except (TypeError, ValueError):
        return 0


def _server_uidvalidity(client: ImapLike, folder: str) -> int | None:
    """Read the folder's UIDVALIDITY (so a server-side UID reset invalidates the
    cache). Best-effort: returns None if the server/STATUS doesn't provide it."""
    try:
        typ, data = client.status(folder, "(UIDVALIDITY)")  # type: ignore[attr-defined]
    except Exception:
        return None
    if not data or not data[0]:
        return None
    raw = data[0] if isinstance(data[0], bytes) else str(data[0]).encode()
    match = _UIDVALIDITY_RE.search(raw)
    return int(match.group(1)) if match else None


def _fetch_flags(client: ImapLike, uids: list[str]) -> dict[str, list[str]]:
    """One batched ``UID FETCH (FLAGS)`` so read/unread stays fresh cheaply."""
    out: dict[str, list[str]] = {}
    if not uids:
        return out
    typ, data = client.uid("FETCH", ",".join(uids), "(FLAGS)")
    for item in data or []:
        raw = item[0] if isinstance(item, (tuple, list)) and item else item
        if raw is None:
            continue
        if isinstance(raw, str):
            raw = raw.encode()
        if not isinstance(raw, bytes):
            continue
        um = _UID_RE.search(raw)
        if not um:
            continue
        fm = _FLAGS_RE.search(raw)
        flags = [f.decode() if isinstance(f, bytes) else f for f in (fm.group(1).split() if fm else [])]
        out[um.group(1).decode()] = flags
    return out


def sync_folder(
    account: MailAccount,
    *,
    account_id: str,
    folder: str = "INBOX",
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
    on_progress: Callable[[int, int], None] | None = None,
    now: float | None = None,
    save_every: int = 25,
) -> dict[str, Any]:
    """Incrementally sync ``folder`` into the local cache.

    Fetches only UIDs not already cached, drops UIDs no longer on the server, and
    refreshes flags for the rest — so the whole folder is never re-downloaded.
    ``on_progress(processed, total)`` reports new-message fetch progress.
    """
    now = time.time() if now is None else now
    doc = _cache.load(account_id, folder)
    client = ops.connect_imap(account, imap_factory=imap_factory)
    try:
        client.select(folder, readonly=True)
        uidvalidity = _server_uidvalidity(client, folder)
        if doc.get("uidvalidity") != uidvalidity:
            _cache.reset_messages(doc, uidvalidity)

        typ, data = client.uid("SEARCH", "ALL")
        server_uids = [_decode_uid(x) for x in (data[0].split() if data and data[0] else [])]
        server_set = set(server_uids)

        cached = _cache.cached_uids(doc)
        removed = cached - server_set
        _cache.remove_uids(doc, removed)

        # refresh flags for messages we already have (read/unread changes)
        existing = [u for u in server_uids if u in cached and u not in removed]
        for uid, flags in _fetch_flags(client, existing).items():
            _cache.update_flags(doc, uid, flags)

        # Fetch newest first (UID SEARCH returns ascending) so that during a big
        # initial sync the most recent mail populates — and appears at the top of
        # the inbox — before the backlog, not after it.
        new_uids = [u for u in server_uids if u not in cached]
        new_uids.sort(key=_uid_sort_key, reverse=True)
        total = len(new_uids)
        if on_progress:
            on_progress(0, total)
        for index, uid in enumerate(new_uids):
            typ, fetched = client.uid("FETCH", uid, "(FLAGS RFC822)")
            split = _split_fetch(fetched[0]) if fetched and fetched[0] else None
            if split:
                envelope, raw_bytes = split
                dto = parse_rfc822(
                    raw_bytes,
                    uid=uid,
                    provider=account.provider,
                    account=account.email,
                    flags=_parse_flags(envelope),
                )
                _cache.upsert_message(doc, dto.to_dict())
            if on_progress:
                on_progress(index + 1, total)
            if save_every and (index + 1) % save_every == 0:
                doc["uidvalidity"] = uidvalidity
                _cache.save(doc, now=now)

        doc["uidvalidity"] = uidvalidity
        _cache.save(doc, now=now)
        return {
            "new": total,
            "removed": len(removed),
            "total": len(doc["messages"]),
            "uidvalidity": uidvalidity,
        }
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
