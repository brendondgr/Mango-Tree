"""DTOs for the mailbox app.

``AccountConfig`` is the persisted account *settings* model (validated on the way
in via ``from_dict``, serialized out via ``to_dict``). It NEVER carries a secret —
only a ``credential_ref`` key name that points into the secret store.

``MessageDTO`` and ``FolderNode`` are the normalized message / folder shapes the
services, API, and agent tools all share.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from utils.apps.mailbox.shared.errors import ValidationError

VALID_PROVIDERS = ("gmail", "m365", "exchange", "yahoo")
VALID_STATUS = ("untested", "ok", "error")
VALID_COLORS = (
    "sky", "mint", "coral", "lavender", "tangerine",
    "rose", "violet", "teal", "amber", "lime",
    "indigo", "peach", "sage", "crimson", "slate",
)

# Keys that look like a secret and must never be accepted into account settings.
# The config store asserts against this set as a defensive secret-leak guard.
SECRET_KEYS = (
    "credential",
    "secret",
    "password",
    "app_password",
    "access_token",
    "token",
    "graph_token",
)


def _req_str(data: dict, key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"'{key}' is required", details={"field": key})
    return value


def _opt_str(data: dict, key: str) -> str | None:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string", details={"field": key})
    return value or None


def _opt_int(data: dict, key: str) -> int | None:
    value = data.get(key)
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"'{key}' must be an integer", details={"field": key}) from exc


def _opt_bool(data: dict, key: str, default: bool) -> bool:
    value = data.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


# --- persisted account settings ----------------------------------------------

@dataclass(frozen=True)
class AccountConfig:
    id: str
    provider: str
    display_name: str
    email: str
    enabled: bool = True
    credential_ref: str | None = None
    status: str = "untested"
    use_graph: bool = False
    imap_host: str | None = None
    imap_port: int | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    color: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "AccountConfig":
        if not isinstance(data, dict):
            raise ValidationError("account must be a JSON object")

        provider = _req_str(data, "provider")
        if provider not in VALID_PROVIDERS:
            raise ValidationError(
                f"unknown provider '{provider}'",
                details={"field": "provider", "valid": list(VALID_PROVIDERS)},
            )

        status = data.get("status", "untested")
        if status not in VALID_STATUS:
            raise ValidationError(
                f"invalid status '{status}'",
                details={"field": "status", "valid": list(VALID_STATUS)},
            )

        imap_host = _opt_str(data, "imap_host")
        # On-prem Exchange host is organization-specific and cannot be defaulted.
        if provider == "exchange" and not imap_host:
            raise ValidationError(
                "exchange accounts require an imap_host",
                details={"field": "imap_host"},
            )

        color = _opt_str(data, "color")
        if color is not None and color not in VALID_COLORS:
            raise ValidationError(
                f"invalid color '{color}'",
                details={"field": "color", "valid": list(VALID_COLORS)},
            )

        return cls(
            id=_req_str(data, "id"),
            provider=provider,
            display_name=_req_str(data, "display_name"),
            email=_req_str(data, "email"),
            enabled=_opt_bool(data, "enabled", True),
            credential_ref=_opt_str(data, "credential_ref"),
            status=status,
            use_graph=_opt_bool(data, "use_graph", False),
            imap_host=imap_host,
            imap_port=_opt_int(data, "imap_port"),
            smtp_host=_opt_str(data, "smtp_host"),
            smtp_port=_opt_int(data, "smtp_port"),
            color=color,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "provider": self.provider,
            "display_name": self.display_name,
            "email": self.email,
            "enabled": self.enabled,
            "credential_ref": self.credential_ref,
            "status": self.status,
            "use_graph": self.use_graph,
            "imap_host": self.imap_host,
            "imap_port": self.imap_port,
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "color": self.color,
        }


# --- normalized message -------------------------------------------------------

@dataclass
class MessageDTO:
    uid: str
    provider: str
    account: str
    subject: str
    from_addr: str
    to_addr: str
    date: str
    snippet: str
    timestamp: float = 0.0        # epoch seconds parsed from Date — for sorting
    message_id: str = ""          # RFC Message-ID — stable across a folder MOVE
    references: str = ""          # RFC References chain — for reply threading
    reply_to: str = ""            # RFC Reply-To — preferred reply target
    cc_addr: str = ""             # RFC Cc — needed to compute reply-all recipients
    flags: list[str] = field(default_factory=list)
    body_text: str | None = None  # populated only by the message-detail fetch
    body_html: str | None = None

    @property
    def unread(self) -> bool:
        return "\\Seen" not in self.flags

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MessageDTO":
        """Rebuild a DTO from a serialized message (e.g. the local cache)."""
        return cls(
            uid=str(data.get("uid", "")),
            provider=data.get("provider", ""),
            account=data.get("account", ""),
            subject=data.get("subject", ""),
            from_addr=data.get("from", ""),
            to_addr=data.get("to", ""),
            date=data.get("date", ""),
            snippet=data.get("snippet", ""),
            timestamp=float(data.get("timestamp", 0.0) or 0.0),
            message_id=data.get("message_id", ""),
            references=data.get("references", ""),
            reply_to=data.get("reply_to", ""),
            cc_addr=data.get("cc", ""),
            flags=list(data.get("flags", [])),
            body_text=data.get("body_text"),
            body_html=data.get("body_html"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "uid": self.uid,
            "provider": self.provider,
            "account": self.account,
            "subject": self.subject,
            "from": self.from_addr,
            "to": self.to_addr,
            "date": self.date,
            "snippet": self.snippet,
            "timestamp": self.timestamp,
            "message_id": self.message_id,
            "references": self.references,
            "reply_to": self.reply_to,
            "cc": self.cc_addr,
            "flags": self.flags,
            "unread": self.unread,
            "body_text": self.body_text,
            "body_html": self.body_html,
        }


# --- folder tree --------------------------------------------------------------

@dataclass
class FolderNode:
    name: str                    # leaf name, e.g. "Work"
    path: str                    # full path, e.g. "INBOX/Work"
    flags: list[str] = field(default_factory=list)
    selectable: bool = True      # False for \Noselect containers
    children: list["FolderNode"] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "flags": self.flags,
            "selectable": self.selectable,
            "children": [c.to_dict() for c in self.children],
        }
