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
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Any, Callable, Protocol

from utils.apps.mailbox.shared.errors import (
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

    Uses the IMAP MOVE extension (RFC 6851) when the account/server supports it;
    otherwise falls back to COPY + STORE \\Deleted + EXPUNGE, which every IMAP
    server supports. Exchange on-prem typically needs the fallback.
    """
    if not uid:
        raise ValidationError("uid is required", details={"uid": uid})
    client = connect_imap(account, imap_factory=imap_factory)
    try:
        if create_if_missing:
            create_folder(client, dest_folder)

        client.select(source_folder, readonly=False)

        caps = " ".join(
            c.decode() if isinstance(c, bytes) else str(c) for c in (client.capabilities() or [])
        ).upper()
        use_move = account.supports_move and "MOVE" in caps

        if use_move:
            typ, data = client.uid("MOVE", uid, dest_folder)
            if not _imap_ok((typ, data)):
                raise ProviderError("UID MOVE failed", details={"uid": uid})
            method = "MOVE"
        else:
            typ, _ = client.uid("COPY", uid, dest_folder)
            if not _imap_ok(typ):
                raise ProviderError("UID COPY failed", details={"uid": uid})
            client.uid("STORE", uid, "+FLAGS", "(\\Deleted)")
            client.expunge()
            method = "COPY+EXPUNGE"

        return {"uid": uid, "moved_to": dest_folder, "method": method}
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

        refused = smtp.send_message(msg, from_addr=account.email, to_addrs=all_rcpts)
        return {
            "sent": True,
            "accepted": [r for r in all_rcpts if r not in (refused or {})],
            "refused": list((refused or {}).keys()),
        }
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


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
