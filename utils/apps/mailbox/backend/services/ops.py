"""Shared mailbox operations core (standalone, testable).

Holds the actual IMAP/SMTP mechanics behind the operations the provider modules
expose:

  1. organize  -> move a message into a folder (create the folder if needed)
  2. send      -> submit a message via SMTP
  3. tree      -> retrieve the full folder structure of the mailbox

Design follows the platform's Strava service:
- credentials come from a ``MailAccount`` (built by the providers registry from
  the config store + secret store);
- network pieces sit behind injectable factories (``imap_factory`` /
  ``smtp_factory``) so logic is unit-testable with no live server;
- missing/invalid credentials raise a typed ``PermissionDeniedError`` rather
  than prompting — safe on a server or from an agent.

The provider registry (``services/providers``) configures the per-provider
differences: auth mode, whether IMAP MOVE is available, and Gmail's label
semantics. M365 additionally documents the Microsoft Graph alternative.

Relocated from the standalone ``mailbox_ops.py`` — logic unchanged; only the
typed errors and ``FolderNode`` now come from ``shared/``.
"""

from __future__ import annotations

import base64
import email
import smtplib
from dataclasses import dataclass, field
from email.header import decode_header, make_header
from email.message import EmailMessage
from typing import Any, Callable, Protocol, Sequence

from utils.apps.mailbox.shared.errors import (
    NotFoundError,
    PermissionDeniedError,
    ProviderError,
    ValidationError,
)
from utils.apps.mailbox.shared.schemas import FolderNode


# --- account ------------------------------------------------------------------

@dataclass(frozen=True)
class MailAccount:
    provider: str
    email: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    auth: str                       # "oauth2" | "password" | "either"
    app_password: str | None = None
    access_token: str | None = None
    supports_move: bool = True      # Exchange on-prem IMAP often does NOT
    folder_delimiter: str = "/"
    # Provider files an SMTP-sent copy to Sent automatically (Gmail). When False
    # a reply IMAP-APPENDs its own copy to the resolved Sent folder (D10).
    files_sent_automatically: bool = False
    # Per-provider well-known folder name map (kind -> folder path), used as the
    # fallback when the server does not advertise RFC 6154 SPECIAL-USE flags (D6).
    well_known_names: dict[str, str] = field(default_factory=dict)

    def require_credentials(self) -> None:
        if self.auth == "oauth2" and not self.access_token:
            raise PermissionDeniedError(
                f"{self.provider} requires an OAuth2 access token",
                details={"missing": "access_token"},
            )
        if self.auth == "password" and not self.app_password:
            raise PermissionDeniedError(
                f"{self.provider} requires an app password",
                details={"missing": "app_password"},
            )
        if self.auth == "either" and not (self.access_token or self.app_password):
            raise PermissionDeniedError(
                f"{self.provider} needs an access token or app password",
                details={"missing": "credentials"},
            )


def build_xoauth2(user: str, access_token: str) -> str:
    """Base64 XOAUTH2 SASL string used by Gmail and M365 SMTP (AUTH command)."""
    raw = f"user={user}\x01auth=Bearer {access_token}\x01\x01"
    return base64.b64encode(raw.encode("utf-8")).decode("ascii")


def _xoauth2_raw(user: str, access_token: str) -> bytes:
    """Raw (un-encoded) SASL bytes for imaplib.authenticate.

    imaplib's _Authenticator.encode() will base64-encode the callback return
    value itself, so we must NOT pre-encode here (unlike the SMTP path).
    """
    return f"user={user}\x01auth=Bearer {access_token}\x01\x01".encode("utf-8")


# --- injectable client seams --------------------------------------------------

class ImapLike(Protocol):
    def login(self, user: str, password: str) -> Any: ...
    def authenticate(self, mechanism: str, authobject: Callable[[bytes], bytes]) -> Any: ...
    def list(self, directory: str = ..., pattern: str = ...) -> Any: ...
    def create(self, mailbox: str) -> Any: ...
    def select(self, mailbox: str, readonly: bool = ...) -> Any: ...
    def uid(self, command: str, *args: Any) -> Any: ...
    def copy(self, message_set: str, new_mailbox: str) -> Any: ...
    def store(self, message_set: str, command: str, flags: str) -> Any: ...
    def append(self, mailbox: str, flags: Any, date_time: Any, message: bytes) -> Any: ...
    def expunge(self) -> Any: ...
    def capabilities(self) -> Any: ...
    def logout(self) -> Any: ...


def _default_imap_factory(account: MailAccount) -> ImapLike:
    import imaplib  # lazy: only needed for real connections

    return imaplib.IMAP4_SSL(account.imap_host, account.imap_port)


def _default_smtp_factory(account: MailAccount):
    smtp = smtplib.SMTP(account.smtp_host, account.smtp_port, timeout=30)
    smtp.ehlo()
    smtp.starttls()
    smtp.ehlo()
    return smtp


def connect_imap(
    account: MailAccount,
    *,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> ImapLike:
    """Open an authenticated IMAP connection. OAuth2 -> XOAUTH2, else app pw."""
    account.require_credentials()
    client = (imap_factory or _default_imap_factory)(account)
    if account.access_token and account.auth in ("oauth2", "either"):
        raw = _xoauth2_raw(account.email, account.access_token)
        client.authenticate("XOAUTH2", lambda _c: raw)
    elif account.app_password:
        client.login(account.email, account.app_password)
    else:  # pragma: no cover - guarded by require_credentials
        raise PermissionDeniedError("no usable credentials")
    return client


# =============================================================================
# 1. ORGANIZE — move a message into a folder
# =============================================================================

def _imap_ok(resp: Any) -> bool:
    typ = resp[0] if isinstance(resp, (tuple, list)) else resp
    return typ == "OK"


def create_folder(client: ImapLike, name: str) -> dict[str, Any]:
    """Create a folder/label. Idempotent: an 'already exists' is not fatal."""
    typ, data = client.create(name)
    if typ != "OK":
        text = (data[0].decode() if data and isinstance(data[0], bytes) else str(data)).lower()
        if "exist" not in text:
            raise ProviderError(f"could not create folder '{name}'", details={"server": text})
    return {"folder": name, "created": typ == "OK"}


def _uid_set(uids: Sequence[str]) -> tuple[str, list[str]]:
    """Normalize a UID collection into an IMAP message-set string + a clean list.

    IMAP accepts comma-separated UIDs and ranges (``"1,2,5"``), so a whole batch
    is a single round trip. Empty/blank UIDs are dropped; an all-empty set is a
    validation error.
    """
    items = [str(u).strip() for u in uids if str(u).strip()]
    if not items:
        raise ValidationError("at least one uid is required", details={"uids": list(uids)})
    return ",".join(items), items


def _uid_move(client: ImapLike, account: MailAccount, message_set: str, dest_folder: str) -> str:
    """Move an already-selected UID set into ``dest_folder``; return the method.

    Uses the IMAP MOVE extension (RFC 6851) when the account/server supports it;
    otherwise falls back to COPY + STORE \\Deleted + EXPUNGE, which every IMAP
    server supports. Exchange on-prem typically needs the fallback. The caller is
    responsible for selecting the source folder first.
    """
    caps = " ".join(
        c.decode() if isinstance(c, bytes) else str(c) for c in (client.capabilities() or [])
    ).upper()
    if account.supports_move and "MOVE" in caps:
        typ, data = client.uid("MOVE", message_set, dest_folder)
        if not _imap_ok((typ, data)):
            raise ProviderError("UID MOVE failed", details={"uids": message_set})
        return "MOVE"
    typ, _ = client.uid("COPY", message_set, dest_folder)
    if not _imap_ok(typ):
        raise ProviderError("UID COPY failed", details={"uids": message_set})
    client.uid("STORE", message_set, "+FLAGS", "(\\Deleted)")
    client.expunge()
    return "COPY+EXPUNGE"


def organize_message(
    account: MailAccount,
    *,
    uid: str,
    source_folder: str,
    dest_folder: str,
    create_if_missing: bool = True,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> dict[str, Any]:
    """Move a single message (by UID) from ``source_folder`` to ``dest_folder``.

    Thin single-UID wrapper over the shared move core; kept for back-compat with
    the ``mailbox_organize_message`` tool. See :func:`move_messages` for batches.
    """
    if not uid:
        raise ValidationError("uid is required", details={"uid": uid})
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        if create_if_missing:
            create_folder(client, dest_folder)
        client.select(source_folder, readonly=False)
        method = _uid_move(client, account, uid, dest_folder)
        return {"uid": uid, "moved_to": dest_folder, "method": method}
    finally:
        _safe_logout(client)


def move_messages(
    account: MailAccount,
    *,
    uids: Sequence[str],
    source_folder: str,
    dest_folder: str,
    create_if_missing: bool = True,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> dict[str, Any]:
    """Move a batch of messages (by UID) from ``source_folder`` to ``dest_folder``
    in one IMAP round trip (D9). Same MOVE / COPY+EXPUNGE semantics as organize."""
    message_set, items = _uid_set(uids)
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        if create_if_missing:
            create_folder(client, dest_folder)
        client.select(source_folder, readonly=False)
        method = _uid_move(client, account, message_set, dest_folder)
        return {"uids": items, "moved_to": dest_folder, "method": method}
    finally:
        _safe_logout(client)


# =============================================================================
# 1b. WELL-KNOWN FOLDERS — resolve Trash/Sent/Junk/Archive/Drafts (D6)
# =============================================================================

# RFC 6154 SPECIAL-USE attributes advertised on the LIST response, per kind.
_SPECIAL_USE = {
    "trash": "\\Trash",
    "sent": "\\Sent",
    "junk": "\\Junk",
    "archive": "\\Archive",
    "drafts": "\\Drafts",
}


def _resolve_special_use(client: ImapLike, kind: str) -> str | None:
    """Return the folder path the server flags for ``kind`` (RFC 6154), or None."""
    flag = _SPECIAL_USE.get(kind)
    if not flag:
        return None
    typ, data = client.list("", "*")
    if typ != "OK":
        return None
    for line in data or []:
        parsed = _parse_list_line(line)
        if not parsed:
            continue
        flags, _delim, name = parsed
        if any(f.lower() == flag.lower() for f in flags):
            return name
    return None


def well_known_folder(
    account: MailAccount,
    kind: str,
    *,
    client: ImapLike | None = None,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> str:
    """Resolve a well-known folder (``trash``/``sent``/``junk``/``archive``/``drafts``).

    Prefers the server's RFC 6154 SPECIAL-USE flag from the LIST response so the
    agent never has to guess a path; falls back to the per-provider name map on
    the account. Pass an open ``client`` to reuse an existing connection.
    """
    kind = kind.lower()
    if kind not in _SPECIAL_USE:
        raise ValidationError(
            f"unknown well-known folder kind '{kind}'",
            details={"kind": kind, "valid": list(_SPECIAL_USE)},
        )
    if client is not None:
        name = _resolve_special_use(client, kind)
    else:
        conn = connect_imap(account, imap_factory=imap_factory)
        try:
            name = _resolve_special_use(conn, kind)
        finally:
            _safe_logout(conn)
    name = name or account.well_known_names.get(kind)
    if not name:
        raise ValidationError(
            f"could not resolve the {kind} folder for {account.provider}",
            details={"kind": kind, "provider": account.provider},
        )
    return name


# =============================================================================
# 1c. DELETE — soft (move to Trash, reversible) or permanent (expunge)
# =============================================================================

def delete_message(
    account: MailAccount,
    *,
    uids: Sequence[str],
    source_folder: str = "INBOX",
    permanent: bool = False,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> dict[str, Any]:
    """Delete a batch of messages by UID.

    ``permanent=False`` (default) moves them to the account's Trash — reversible.
    On Gmail this strips other labels but the message survives in All Mail until a
    permanent delete. ``permanent=True`` selects ``source_folder``, sets
    ``\\Deleted`` and EXPUNGEs — irreversible; run it from within Trash.
    """
    message_set, items = _uid_set(uids)
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        if permanent:
            client.select(source_folder, readonly=False)
            typ, _ = client.uid("STORE", message_set, "+FLAGS", "(\\Deleted)")
            if not _imap_ok(typ):
                raise ProviderError("UID STORE \\Deleted failed", details={"uids": message_set})
            client.expunge()
            return {"uids": items, "deleted": True, "permanent": True, "source": source_folder}
        trash = well_known_folder(account, "trash", client=client)
        client.select(source_folder, readonly=False)
        method = _uid_move(client, account, message_set, trash)
        return {
            "uids": items, "deleted": True, "permanent": False,
            "moved_to": trash, "method": method,
        }
    finally:
        _safe_logout(client)


# =============================================================================
# 1d. FLAGS — mark read/unread, star/unstar (UID STORE +/-FLAGS)
# =============================================================================

def set_flags(
    account: MailAccount,
    *,
    uids: Sequence[str],
    add: Sequence[str] = (),
    remove: Sequence[str] = (),
    source_folder: str = "INBOX",
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> dict[str, Any]:
    """Add and/or remove IMAP flags on a batch of messages.

    e.g. ``add=("\\Seen",)`` marks read, ``remove=("\\Seen",)`` marks unread,
    ``add=("\\Flagged",)`` stars. Reversible, so ungated.
    """
    message_set, items = _uid_set(uids)
    add_list, remove_list = list(add), list(remove)
    if not add_list and not remove_list:
        raise ValidationError(
            "nothing to change: pass add and/or remove flags",
            details={"uids": items},
        )
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        client.select(source_folder, readonly=False)
        if add_list:
            typ, _ = client.uid("STORE", message_set, "+FLAGS", "(%s)" % " ".join(add_list))
            if not _imap_ok(typ):
                raise ProviderError("UID STORE +FLAGS failed", details={"uids": message_set})
        if remove_list:
            typ, _ = client.uid("STORE", message_set, "-FLAGS", "(%s)" % " ".join(remove_list))
            if not _imap_ok(typ):
                raise ProviderError("UID STORE -FLAGS failed", details={"uids": message_set})
        return {"uids": items, "added": add_list, "removed": remove_list}
    finally:
        _safe_logout(client)


# =============================================================================
# 2. SEND — submit a message via SMTP
# =============================================================================

def send_message(
    account: MailAccount,
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    html: str | None = None,
    smtp_factory: Callable[[MailAccount], Any] | None = None,
) -> dict[str, Any]:
    """Send a plain-text (optionally + HTML) message.

    SMTP over STARTTLS on 587. OAuth2 accounts authenticate with XOAUTH2; app
    -password accounts use AUTH LOGIN. Returns the recipients accepted.

    Note: IMAP/SMTP send does not auto-file a copy to Sent for every provider.
    The Graph path (provider_m365) sets ``saveToSentItems`` and does; the IMAP
    path here does not APPEND to Sent (kept simple and provider-neutral).
    """
    if not to:
        raise ValidationError("at least one recipient is required", details={"to": to})
    account.require_credentials()

    msg = EmailMessage()
    msg["From"] = account.email
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    all_rcpts = list(to) + list(cc or []) + list(bcc or [])
    refused = _smtp_send(account, msg, all_rcpts, smtp_factory=smtp_factory)
    return {
        "sent": True,
        "accepted": [r for r in all_rcpts if r not in refused],
        "refused": list(refused.keys()),
    }


def _smtp_send(
    account: MailAccount,
    msg: EmailMessage,
    all_rcpts: list[str],
    *,
    smtp_factory: Callable[[MailAccount], Any] | None = None,
) -> dict:
    """Authenticate (XOAUTH2 or AUTH LOGIN) and submit ``msg``; return the refused
    map. Shared by :func:`send_message` and :func:`reply_message`."""
    smtp = (smtp_factory or _default_smtp_factory)(account)
    try:
        if account.access_token and account.auth in ("oauth2", "either"):
            auth_str = build_xoauth2(account.email, account.access_token)
            code, resp = smtp.docmd("AUTH", "XOAUTH2 " + auth_str)
            if code != 235:
                raise PermissionDeniedError(
                    "SMTP XOAUTH2 auth rejected",
                    details={"code": code, "resp": _as_text(resp)},
                )
        else:
            smtp.login(account.email, account.app_password)
        return smtp.send_message(msg, from_addr=account.email, to_addrs=all_rcpts) or {}
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


# =============================================================================
# 2b. REPLY — reply / reply-all to an existing message (threaded)
# =============================================================================

def _plain_text_body(msg: "email.message.Message") -> str:  # type: ignore[name-defined]
    """Best-effort text/plain body of a message, for quoting in a reply."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() != "text/plain":
                continue
            if "attachment" in str(part.get("Content-Disposition", "")).lower():
                continue
            try:
                return (part.get_payload(decode=True) or b"").decode(
                    part.get_content_charset() or "utf-8", errors="replace"
                )
            except Exception:
                return ""
        return ""
    try:
        return (msg.get_payload(decode=True) or b"").decode(
            msg.get_content_charset() or "utf-8", errors="replace"
        )
    except Exception:
        return ""


def _reply_recipients(original, account_email: str, reply_all: bool) -> tuple[list[str], list[str]]:
    """Compute (to, cc) for a reply. ``to`` is the original Reply-To or From;
    reply-all adds the original To+Cc, minus the account's own address."""
    import email.utils as _eu

    def addrs(headers: list[str]) -> list[str]:
        return [a for _n, a in _eu.getaddresses([h for h in headers if h]) if a]

    target = original.get("Reply-To") or original.get("From") or ""
    to_list: list[str] = []
    seen: set[str] = set()
    for a in addrs([target]):
        if a.lower() not in seen:
            to_list.append(a)
            seen.add(a.lower())
    cc_list: list[str] = []
    if reply_all:
        seen.add(account_email.lower())
        for a in addrs([original.get("To", ""), original.get("Cc", "")]):
            if a.lower() not in seen:
                cc_list.append(a)
                seen.add(a.lower())
    return to_list, cc_list


def reply_message(
    account: MailAccount,
    *,
    uid: str,
    body: str,
    html: str | None = None,
    reply_all: bool = False,
    source_folder: str = "INBOX",
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
    smtp_factory: Callable[[MailAccount], Any] | None = None,
) -> dict[str, Any]:
    """Reply (or reply-all) to the message ``uid`` in ``source_folder``.

    Fetches the original to thread correctly (``In-Reply-To``/``References``,
    ``Re:`` subject, quoted body) and to compute recipients, sends via SMTP, then
    IMAP-APPENDs the sent copy to the resolved Sent folder with ``\\Seen`` —
    unless the provider files it automatically (Gmail, D10).
    """
    if not uid:
        raise ValidationError("uid is required", details={"uid": uid})
    if not (body or "").strip():
        raise ValidationError("reply body is required", details={"body": body})

    client = connect_imap(account, imap_factory=imap_factory)
    try:
        client.select(source_folder, readonly=True)
        typ, fetched = client.uid("FETCH", uid, "(RFC822)")
        item = fetched[0] if fetched else None
        raw = item[1] if isinstance(item, (tuple, list)) and len(item) >= 2 else None
        if not raw:
            raise NotFoundError(
                f"message {uid} not found in {source_folder}",
                details={"uid": uid, "folder": source_folder},
            )
        original = email.message_from_bytes(raw if isinstance(raw, bytes) else str(raw).encode())

        to_list, cc_list = _reply_recipients(original, account.email, reply_all)
        if not to_list:
            raise ValidationError(
                "could not determine a reply recipient (no From/Reply-To)",
                details={"uid": uid},
            )

        orig_subject = str(make_header(decode_header(original.get("Subject", "") or "")))
        subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"
        orig_id = (original.get("Message-ID", "") or "").strip()
        orig_refs = (original.get("References", "") or "").strip()
        references = f"{orig_refs} {orig_id}".strip() if orig_refs else orig_id

        quoted = "\n".join("> " + line for line in _plain_text_body(original).splitlines())
        attribution = f"On {original.get('Date', '')}, {original.get('From', '')} wrote:".strip()
        text_body = f"{body}\n\n{attribution}\n{quoted}\n" if quoted else f"{body}\n"

        msg = EmailMessage()
        msg["From"] = account.email
        msg["To"] = ", ".join(to_list)
        if cc_list:
            msg["Cc"] = ", ".join(cc_list)
        msg["Subject"] = subject
        if orig_id:
            msg["In-Reply-To"] = orig_id
        if references:
            msg["References"] = references
        msg.set_content(text_body)
        if html:
            msg.add_alternative(html, subtype="html")

        all_rcpts = to_list + cc_list
        refused = _smtp_send(account, msg, all_rcpts, smtp_factory=smtp_factory)

        filed_to_sent = False
        if not account.files_sent_automatically:
            try:
                sent_folder = well_known_folder(account, "sent", client=client)
                client.append(sent_folder, "(\\Seen)", None, msg.as_bytes())
                filed_to_sent = True
            except Exception:
                filed_to_sent = False  # best-effort; a failed APPEND never fails the reply

        return {
            "sent": True,
            "replied_to": uid,
            "reply_all": reply_all,
            "to": [r for r in to_list if r not in refused],
            "cc": [r for r in cc_list if r not in refused],
            "subject": subject,
            "filed_to_sent": filed_to_sent,
        }
    finally:
        _safe_logout(client)


# =============================================================================
# 3. TREE — retrieve the full folder structure of the mailbox
# =============================================================================

def _parse_list_line(line: bytes | str) -> tuple[list[str], str, str] | None:
    """Parse one IMAP LIST response line -> (flags, delimiter, name)."""
    text = line.decode() if isinstance(line, bytes) else line
    if not text or "(" not in text:
        return None
    flags_part = text[text.find("(") + 1 : text.find(")")]
    flags = flags_part.split()
    rest = text[text.find(")") + 1 :].strip()
    # rest looks like:  "/" "INBOX/Work"   (delimiter then quoted name)
    parts = rest.split(" ", 1)
    delimiter = parts[0].strip().strip('"')
    name = parts[1].strip().strip('"') if len(parts) > 1 else ""
    return flags, delimiter, name


def folder_tree(
    account: MailAccount,
    *,
    imap_factory: Callable[[MailAccount], ImapLike] | None = None,
) -> dict[str, Any]:
    """Return the complete folder hierarchy as a nested tree plus a flat list.

    Uses IMAP ``LIST "" "*"`` and builds the tree from the server-reported
    hierarchy delimiter. Server-reported flags (\\HasChildren, \\Noselect,
    \\Sent, \\Trash, ...) are preserved so callers can identify special folders.
    """
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        typ, data = client.list("", "*")
        if typ != "OK":
            raise ProviderError("LIST failed", details={"server": _as_text(data)})

        flat: list[dict[str, Any]] = []
        roots: list[FolderNode] = []
        index: dict[str, FolderNode] = {}

        rows = []
        for line in data or []:
            parsed = _parse_list_line(line)
            if parsed:
                rows.append(parsed)
        # shallow paths first so parents exist before children
        rows.sort(key=lambda r: r[2].count(r[1] or account.folder_delimiter))

        for flags, delimiter, name in rows:
            delim = delimiter or account.folder_delimiter
            selectable = "\\Noselect" not in flags and "\\NonExistent" not in flags
            node = FolderNode(
                name=name.split(delim)[-1], path=name, flags=flags, selectable=selectable
            )
            index[name] = node
            flat.append({"path": name, "flags": flags, "selectable": selectable})
            if delim in name:
                parent_path = name.rsplit(delim, 1)[0]
                parent = index.get(parent_path)
                (parent.children if parent else roots).append(node)
            else:
                roots.append(node)

        return {
            "tree": [r.to_dict() for r in roots],
            "flat": flat,
            "count": len(flat),
        }
    finally:
        _safe_logout(client)


# --- small helpers ------------------------------------------------------------

def _as_text(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        value = value[0] if value else b""
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return str(value)


def _safe_logout(client: ImapLike) -> None:
    try:
        client.logout()
    except Exception:
        pass


# --- offline self-test (no network) ------------------------------------------

def _selftest() -> None:
    sent_log: dict[str, Any] = {}

    class FakeImap:
        def __init__(self, with_move=True):
            self.with_move = with_move
            self.commands: list[tuple] = []
            self.expunged = False
        def login(self, u, p): self.commands.append(("login", u))
        def authenticate(self, mech, fn): fn(b""); self.commands.append(("auth", mech))
        def create(self, mb): self.commands.append(("create", mb)); return ("OK", [b"created"])
        def select(self, mb, readonly=False): self.commands.append(("select", mb, readonly)); return ("OK", [b"3"])
        def capabilities(self):
            return [b"IMAP4REV1", b"MOVE"] if self.with_move else [b"IMAP4REV1"]
        def uid(self, cmd, *args):
            self.commands.append(("uid", cmd, *args)); return ("OK", [b"ok"])
        def store(self, *a): self.commands.append(("store", *a)); return ("OK", [b"ok"])
        def expunge(self): self.expunged = True; return ("OK", [b"1"])
        def list(self, directory="", pattern="*"):
            return ("OK", [
                b'(\\HasChildren) "/" "INBOX"',
                b'(\\HasNoChildren) "/" "INBOX/Work"',
                b'(\\HasNoChildren) "/" "INBOX/Work/Urgent"',
                b'(\\Sent \\HasNoChildren) "/" "Sent"',
                b'(\\Trash \\HasNoChildren) "/" "[Gmail]/Trash"',
                b'(\\Noselect \\HasChildren) "/" "[Gmail]"',
            ])
        def logout(self): self.commands.append(("logout",))

    class FakeSmtp:
        def __init__(self): self.authed = None; self.sent = None
        def docmd(self, cmd, arg): self.authed = (cmd, arg[:6]); return (235, b"2.7.0 ok")
        def login(self, u, p): self.authed = ("LOGIN", u)
        def send_message(self, msg, from_addr=None, to_addrs=None):
            sent_log["to"] = to_addrs; sent_log["subj"] = msg["Subject"]; return {}
        def quit(self): pass

    oauth = MailAccount("gmail", "me@gmail.com", "imap.gmail.com", 993,
                        "smtp.gmail.com", 587, "oauth2", access_token="TOK")
    pw = MailAccount("yahoo", "me@yahoo.com", "imap.mail.yahoo.com", 993,
                     "smtp.mail.yahoo.com", 587, "password", app_password="APPPW")

    # 1a. organize via MOVE
    fake = FakeImap(with_move=True)
    r = organize_message(oauth, uid="7", source_folder="INBOX", dest_folder="INBOX/Work",
                         imap_factory=lambda a: fake)
    assert r["method"] == "MOVE" and r["moved_to"] == "INBOX/Work", r
    assert ("uid", "MOVE", "7", "INBOX/Work") in fake.commands

    # 1b. organize via COPY+EXPUNGE fallback (no MOVE capability)
    fake2 = FakeImap(with_move=False)
    r2 = organize_message(pw, uid="9", source_folder="INBOX", dest_folder="Archive",
                          imap_factory=lambda a: fake2)
    assert r2["method"] == "COPY+EXPUNGE" and fake2.expunged, r2

    # 1c. supports_move=False forces fallback even if server advertises MOVE
    exch = MailAccount("exchange", "me@corp.com", "mail.corp.com", 993,
                       "mail.corp.com", 587, "either", app_password="pw", supports_move=False)
    r3 = organize_message(exch, uid="1", source_folder="INBOX", dest_folder="Done",
                          imap_factory=lambda a: FakeImap(with_move=True))
    assert r3["method"] == "COPY+EXPUNGE", r3

    # 1d. move_messages (batch) — one MOVE round trip for a UID set
    fakeb = FakeImap(with_move=True)
    rb = move_messages(oauth, uids=["7", "8"], source_folder="INBOX",
                       dest_folder="INBOX/Work", imap_factory=lambda a: fakeb)
    assert rb["method"] == "MOVE" and rb["uids"] == ["7", "8"], rb
    assert ("uid", "MOVE", "7,8", "INBOX/Work") in fakeb.commands

    # 1e. well_known_folder resolves Trash via the RFC 6154 SPECIAL-USE flag
    trash = well_known_folder(oauth, "trash", imap_factory=lambda a: FakeImap())
    assert trash == "[Gmail]/Trash", trash

    # 1f. well_known_folder falls back to the provider name map (no SPECIAL-USE)
    class NoSpecialUse(FakeImap):
        def list(self, directory="", pattern="*"):
            return ("OK", [b'(\\HasNoChildren) "/" "INBOX"', b'(\\HasNoChildren) "/" "Custom"'])
    mapped = MailAccount("yahoo", "me@yahoo.com", "imap.mail.yahoo.com", 993,
                         "smtp.mail.yahoo.com", 587, "password", app_password="APPPW",
                         well_known_names={"trash": "Trash"})
    assert well_known_folder(mapped, "trash", imap_factory=lambda a: NoSpecialUse()) == "Trash"

    # 1g. soft delete = reversible move to Trash
    faked = FakeImap(with_move=True)
    rd = delete_message(oauth, uids=["9"], source_folder="INBOX", imap_factory=lambda a: faked)
    assert rd["permanent"] is False and rd["moved_to"] == "[Gmail]/Trash", rd

    # 1h. permanent delete = STORE \Deleted + EXPUNGE within the source folder
    fakep = FakeImap(with_move=True)
    rp = delete_message(oauth, uids=["9"], source_folder="[Gmail]/Trash", permanent=True,
                        imap_factory=lambda a: fakep)
    assert rp["permanent"] is True and fakep.expunged, rp
    assert ("uid", "STORE", "9", "+FLAGS", "(\\Deleted)") in fakep.commands

    # 1i. set_flags — mark read + star in one STORE
    fakef = FakeImap()
    rf = set_flags(oauth, uids=["3"], add=["\\Seen", "\\Flagged"], imap_factory=lambda a: fakef)
    assert rf["added"] == ["\\Seen", "\\Flagged"], rf
    assert ("uid", "STORE", "3", "+FLAGS", "(\\Seen \\Flagged)") in fakef.commands

    # 2. send (XOAUTH2 path)
    smtp = FakeSmtp()
    s = send_message(oauth, to=["a@x.com"], subject="Hi", body="hello",
                     smtp_factory=lambda a: smtp)
    assert s["sent"] and smtp.authed[0] == "AUTH" and sent_log["subj"] == "Hi", s

    # 3. tree
    t = folder_tree(oauth, imap_factory=lambda a: FakeImap())
    paths = {f["path"] for f in t["flat"]}
    assert {"INBOX", "INBOX/Work", "INBOX/Work/Urgent", "Sent"} <= paths, paths
    inbox = next(n for n in t["tree"] if n["path"] == "INBOX")
    work = next(c for c in inbox["children"] if c["path"] == "INBOX/Work")
    assert any(c["path"] == "INBOX/Work/Urgent" for c in work["children"]), t["tree"]
    gmail_container = next(n for n in t["tree"] if n["path"] == "[Gmail]")
    assert gmail_container["selectable"] is False  # \Noselect honored

    # 4. denial: missing creds -> typed permission error, never a prompt
    try:
        folder_tree(MailAccount("gmail", "x@gmail.com", "imap.gmail.com", 993,
                                "smtp.gmail.com", 587, "oauth2"),
                    imap_factory=lambda a: FakeImap())
        raise AssertionError("expected PermissionDeniedError")
    except PermissionDeniedError as exc:
        assert exc.details["missing"] == "access_token"

    print("mailbox ops selftest OK — all assertions passed")


if __name__ == "__main__":
    _selftest()
