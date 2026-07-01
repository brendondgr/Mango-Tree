"""Stage 7 verification: agent tools produce structured output, call the same
services as the API, gate the irreversible send, and surface typed errors. No
network — services are mocked."""

from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import MagicMock

import yaml
from django.conf import settings

from utils.apps.mailbox.agent import tools
from utils.apps.mailbox.shared.errors import NotFoundError, PermissionDeniedError
from utils.apps.mailbox.shared.schemas import AccountConfig, MessageDTO


# --- reads --------------------------------------------------------------------

def test_list_accounts_structured_and_omits_secret_ref():
    mock = MagicMock()
    mock.list_accounts.return_value = [
        AccountConfig(id="a1", provider="gmail", display_name="Work", email="w@x.com",
                      credential_ref="MAIL_GMAIL_WORK"),
    ]
    payload = tools.list_accounts(service=mock)
    assert payload["accounts"] == [
        {"id": "a1", "provider": "gmail", "email": "w@x.com",
         "display_name": "Work", "enabled": True},
    ]
    # the tool surface never includes credential_ref or any secret material
    assert "credential_ref" not in payload["accounts"][0]


def test_list_messages_delegates_and_serializes():
    mock = MagicMock()
    mock.list_messages.return_value = [
        MessageDTO(uid="2", provider="gmail", account="w@x.com", subject="Hi",
                   from_addr="a@x.com", to_addr="w@x.com", date="Mon, 22 Jun 2026",
                   snippet="hey", message_id="<m1@x>"),
    ]
    payload = tools.list_messages(account="a1", folder="INBOX", limit=10, service=mock)
    assert payload["count"] == 1
    assert payload["messages"][0]["subject"] == "Hi"
    assert payload["messages"][0]["message_id"] == "<m1@x>"
    mock.list_messages.assert_called_once_with("a1", folder="INBOX", limit=10)


def test_list_folders_passthrough():
    mock = MagicMock()
    mock.list_folders.return_value = {"tree": [], "flat": [], "count": 0}
    assert tools.list_folders(account="a1", service=mock) == {"tree": [], "flat": [], "count": 0}


# --- mutating (reversible) ----------------------------------------------------

def test_organize_delegates_with_defaults():
    mock = MagicMock()
    mock.organize.return_value = {"uid": "2", "moved_to": "Archive", "method": "MOVE"}
    payload = tools.organize_message(account="a1", uid="2", dest="Archive", service=mock)
    assert payload["method"] == "MOVE"
    mock.organize.assert_called_once_with(
        "a1", uid="2", dest="Archive", source="INBOX", create_if_missing=True
    )


def test_move_messages_batch_delegates():
    mock = MagicMock()
    mock.move.return_value = {"uids": ["2", "3"], "moved_to": "Archive", "method": "MOVE"}
    payload = tools.move_messages(account="a1", uids=["2", "3"], dest="Archive", service=mock)
    assert payload["uids"] == ["2", "3"]
    mock.move.assert_called_once_with(
        "a1", uids=["2", "3"], dest="Archive", source="INBOX", create_if_missing=True
    )


def test_mark_messages_delegates_tristate():
    mock = MagicMock()
    mock.mark.return_value = {"uids": ["2"], "added": ["\\Seen"], "removed": []}
    payload = tools.mark_messages(account="a1", uids=["2"], read=True, service=mock)
    assert payload["added"] == ["\\Seen"]
    mock.mark.assert_called_once_with("a1", uids=["2"], read=True, starred=None, source="INBOX")


def test_create_folder_delegates():
    mock = MagicMock()
    mock.create_folder.return_value = {"folder": "Work", "created": True}
    assert tools.create_folder(account="a1", name="Work", service=mock)["created"] is True


# --- irreversible send (confirm-gated in code) --------------------------------

def test_send_without_confirm_is_denied():
    mock = MagicMock()
    payload = tools.send_message(account="a1", to=["c@x.com"], subject="Hi", body="x", service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.send.assert_not_called()


def test_send_with_confirm_delegates():
    mock = MagicMock()
    mock.send.return_value = {"sent": True, "accepted": ["c@x.com"], "refused": []}
    payload = tools.send_message(
        account="a1", to=["c@x.com"], subject="Hi", body="x", confirm=True, service=mock
    )
    assert payload["sent"] is True
    mock.send.assert_called_once_with(
        "a1", to=["c@x.com"], subject="Hi", body="x", cc=None, html=None
    )


# --- error surfacing ----------------------------------------------------------

def test_missing_credentials_surface_permission_denied():
    mock = MagicMock()
    mock.list_messages.side_effect = PermissionDeniedError("no creds")
    payload = tools.list_messages(account="a1", service=mock)
    assert payload["error"]["code"] == "permission_denied"


def test_unknown_account_surfaces_not_found():
    mock = MagicMock()
    mock.list_folders.side_effect = NotFoundError("missing")
    payload = tools.list_folders(account="ghost", service=mock)
    assert payload["error"]["code"] == "not_found"


# --- registry manifest consistency --------------------------------------------

def test_tools_yaml_entries_resolve():
    config = yaml.safe_load((Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text())
    mailbox_tools = {
        name: meta
        for name, meta in config["tools"].items()
        if meta.get("app") == "mailbox"
    }
    assert len(mailbox_tools) == 8
    for meta in mailbox_tools.values():
        module = importlib.import_module(meta["module"])
        assert callable(getattr(module, meta["function"]))

