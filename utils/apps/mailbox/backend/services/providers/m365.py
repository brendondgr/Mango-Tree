"""Microsoft 365 (Exchange Online) mailbox operations.

Two paths:

  A) IMAP/SMTP with OAuth2 — works today, shares the common core. Basic auth for
     IMAP/POP/EWS was removed in 2022, so a bearer token is mandatory.
  B) Microsoft Graph — the durable path. EWS for Exchange Online begins
     disablement 2026-10-01 and is fully retired 2027-04-01. Graph is recommended
     long-term; the registry honors an account's ``use_graph`` toggle (D3), and
     the Graph tools live here but stay unregistered until an OAuth/Graph token
     flow exists, then swap behind the same tool names.

Auth (both paths): OAuth2 bearer token from Microsoft Entra.
  - IMAP/SMTP scopes:  https://outlook.office.com/IMAP.AccessAsUser.All
                       https://outlook.office.com/SMTP.Send
  - Graph scopes:      Mail.ReadWrite, Mail.Send

In the app, accounts are resolved from the config store via the provider
registry; ``build_account()`` here reads ``MAIL_M365_*`` env vars for
standalone/debug use only.
"""

from __future__ import annotations

import json as _json
import os
from typing import Any, Callable

from utils.apps.mailbox.backend.services.ops import (
    MailAccount,
    PermissionDeniedError,
    ProviderError,
    folder_tree as _folder_tree,
    organize_message as _organize_message,
    send_message as _send_message,
)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


# =============================================================================
# Path A — IMAP/SMTP (shares the common core)
# =============================================================================

def build_account() -> MailAccount:
    addr = os.environ.get("MAIL_M365_EMAIL")
    token = os.environ.get("MAIL_M365_ACCESS_TOKEN")
    if not addr:
        raise PermissionDeniedError("set MAIL_M365_EMAIL", details={"missing": "email"})
    if not token:
        raise PermissionDeniedError(
            "M365 IMAP requires an OAuth2 access token (Basic auth removed 2022)",
            details={"missing": "access_token"},
        )
    return MailAccount(
        provider="m365",
        email=addr,
        imap_host="outlook.office365.com",
        imap_port=993,
        smtp_host="smtp.office365.com",
        smtp_port=587,
        auth="oauth2",
        access_token=token,
        supports_move=True,        # Exchange Online IMAP supports MOVE
        folder_delimiter="/",
    )


def organize(uid: str, *, source: str = "INBOX", dest: str, **kw: Any) -> dict[str, Any]:
    return _organize_message(build_account(), uid=uid, source_folder=source,
                             dest_folder=dest, **kw)


def send(to: list[str], subject: str, body: str, **kw: Any) -> dict[str, Any]:
    return _send_message(build_account(), to=to, subject=subject, body=body, **kw)


def tree(**kw: Any) -> dict[str, Any]:
    return _folder_tree(build_account(), **kw)


# =============================================================================
# Path B — Microsoft Graph (recommended long-term)
# =============================================================================
# The HTTP layer is behind an injectable ``transport`` seam:
#   transport(method, url, headers, json_body) -> (status_code, parsed_json)
# so the Graph logic is unit-testable with no network. The default uses requests.

Transport = Callable[[str, str, dict[str, str], dict | None], tuple[int, Any]]


def _graph_token() -> str:
    token = os.environ.get("MAIL_M365_GRAPH_TOKEN")
    if not token:
        raise PermissionDeniedError(
            "Graph requires a Graph-scoped token (Mail.ReadWrite, Mail.Send)",
            details={"missing": "graph_token"},
        )
    return token


def _default_transport(method: str, url: str, headers: dict[str, str],
                       json_body: dict | None) -> tuple[int, Any]:
    import requests  # lazy: optional dependency

    resp = requests.request(method, url, headers=headers, json=json_body, timeout=30)
    try:
        parsed = resp.json() if resp.content else {}
    except ValueError:
        parsed = {"raw": resp.text}
    return resp.status_code, parsed


def _graph_call(method: str, path: str, *, body: dict | None = None,
                token: str | None = None, transport: Transport | None = None) -> Any:
    headers = {
        "Authorization": f"Bearer {token or _graph_token()}",
        "Content-Type": "application/json",
    }
    status, data = (transport or _default_transport)(method, GRAPH_BASE + path, headers, body)
    if status >= 400:
        code = "permission_denied" if status in (401, 403) else "provider_error"
        err = (data or {}).get("error", {}) if isinstance(data, dict) else {}
        raise (PermissionDeniedError if code == "permission_denied" else ProviderError)(
            f"Graph {method} {path} failed ({status})",
            details={"status": status, "graph_error": err},
        )
    return data


def graph_organize(message_id: str, dest_folder_id: str, *,
                   token: str | None = None, transport: Transport | None = None) -> dict[str, Any]:
    """Move a message to a folder via Graph. dest_folder_id is a folder id or a
    well-known name (e.g. 'archive', 'deleteditems')."""
    data = _graph_call("POST", f"/me/messages/{message_id}/move",
                       body={"destinationId": dest_folder_id},
                       token=token, transport=transport)
    return {"id": data.get("id", message_id), "moved_to": dest_folder_id, "via": "graph"}


def graph_create_folder(display_name: str, *, parent_id: str | None = None,
                        token: str | None = None, transport: Transport | None = None) -> dict[str, Any]:
    path = f"/me/mailFolders/{parent_id}/childFolders" if parent_id else "/me/mailFolders"
    data = _graph_call("POST", path, body={"displayName": display_name},
                       token=token, transport=transport)
    return {"id": data.get("id"), "name": display_name, "via": "graph"}


def graph_send(to: list[str], subject: str, body: str, *, html: bool = False,
               token: str | None = None, transport: Transport | None = None) -> dict[str, Any]:
    message = {
        "subject": subject,
        "body": {"contentType": "HTML" if html else "Text", "content": body},
        "toRecipients": [{"emailAddress": {"address": a}} for a in to],
    }
    _graph_call("POST", "/me/sendMail", body={"message": message, "saveToSentItems": True},
                token=token, transport=transport)
    return {"sent": True, "accepted": list(to), "via": "graph"}


def graph_tree(*, token: str | None = None, transport: Transport | None = None) -> dict[str, Any]:
    """Full folder hierarchy via Graph, recursing through childFolders."""
    def fetch(folder_path: str) -> list[dict[str, Any]]:
        data = _graph_call("GET", folder_path + "?$expand=childFolders&$top=100",
                           token=token, transport=transport)
        nodes = []
        for f in data.get("value", []):
            node = {
                "name": f.get("displayName"),
                "id": f.get("id"),
                "total": f.get("totalItemCount"),
                "unread": f.get("unreadItemCount"),
                "children": [],
            }
            if f.get("childFolderCount"):
                node["children"] = fetch(f"/me/mailFolders/{f['id']}/childFolders")
            nodes.append(node)
        return nodes

    roots = fetch("/me/mailFolders")
    flat: list[dict[str, Any]] = []

    def flatten(nodes, prefix=""):
        for n in nodes:
            path = f"{prefix}/{n['name']}" if prefix else n["name"]
            flat.append({"path": path, "id": n["id"], "total": n["total"]})
            flatten(n["children"], path)

    flatten(roots)
    return {"tree": roots, "flat": flat, "count": len(flat), "via": "graph"}


# --- offline self-test for the Graph path (no network) ------------------------

def _selftest() -> None:
    calls: list[tuple] = []

    def fake_transport(method, url, headers, body):
        calls.append((method, url, body))
        assert headers["Authorization"].startswith("Bearer ")
        if url.endswith("/move"):
            return 200, {"id": "AAMk-moved"}
        if url.endswith("/sendMail"):
            return 202, {}
        if "childFolders" in url and "Work" in url:
            return 200, {"value": []}
        if "mailFolders" in url:
            return 200, {"value": [
                {"id": "f1", "displayName": "Inbox", "totalItemCount": 12,
                 "unreadItemCount": 3, "childFolderCount": 1},
                {"id": "f2", "displayName": "Archive", "totalItemCount": 99,
                 "unreadItemCount": 0, "childFolderCount": 0},
            ]}
        return 200, {}

    # the Inbox has a child folder; serve it on the recursion
    def fake_transport2(method, url, headers, body):
        calls.append((method, url, body))
        if url.endswith("/me/mailFolders?$expand=childFolders&$top=100"):
            return 200, {"value": [
                {"id": "f1", "displayName": "Inbox", "totalItemCount": 12,
                 "unreadItemCount": 3, "childFolderCount": 1},
            ]}
        if "f1/childFolders" in url:
            return 200, {"value": [
                {"id": "f1a", "displayName": "Work", "totalItemCount": 4,
                 "unreadItemCount": 1, "childFolderCount": 0},
            ]}
        return 200, {"value": []}

    moved = graph_organize("AAMk-1", "archive", token="T", transport=fake_transport)
    assert moved["moved_to"] == "archive" and calls[0][0] == "POST"

    sent = graph_send(["a@x.com"], "Hi", "hello", token="T", transport=fake_transport)
    assert sent["sent"] and any(u.endswith("/sendMail") for _, u, _ in calls)

    t = graph_tree(token="T", transport=fake_transport2)
    paths = {f["path"] for f in t["flat"]}
    assert {"Inbox", "Inbox/Work"} <= paths, paths

    # denial: 403 -> typed permission error
    try:
        graph_tree(token="T", transport=lambda *a: (403, {"error": {"code": "Forbidden"}}))
        raise AssertionError("expected PermissionDeniedError")
    except PermissionDeniedError:
        pass

    print("m365 graph selftest OK — all assertions passed")


if __name__ == "__main__":
    import sys
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(_json.dumps(tree(), indent=2))
