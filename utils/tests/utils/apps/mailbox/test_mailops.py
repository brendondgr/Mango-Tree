"""Account-id mutation orchestration: batch move + mark, and the D8 best-effort
cache updates that make a user-driven change show up before the next sync."""

from __future__ import annotations

import pytest

from utils.apps.mailbox.backend.services import cache
from utils.apps.mailbox.backend.services import mailops
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.errors import ValidationError


class FakeImap:
    def __init__(self):
        self.commands: list[tuple] = []

    def authenticate(self, mech, fn):
        fn(b"")

    def login(self, u, p):
        pass

    def create(self, mb):
        return ("OK", [b"ok"])

    def select(self, mb, readonly=False):
        return ("OK", [b"1"])

    def capabilities(self):
        return [b"IMAP4REV1", b"MOVE"]

    def uid(self, cmd, *args):
        self.commands.append(("uid", cmd, *args))
        return ("OK", [b"ok"])

    def expunge(self):
        return ("OK", [b"1"])

    def list(self, directory="", pattern="*"):
        return ("OK", [b'(\\Trash) "/" "[Gmail]/Trash"'])

    def logout(self):
        pass


def _account() -> MailAccount:
    return MailAccount("gmail", "me@gmail.com", "imap.gmail.com", 993,
                       "smtp.gmail.com", 587, "oauth2", access_token="TOK",
                       well_known_names={"trash": "[Gmail]/Trash"})


@pytest.fixture
def cached_inbox(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CACHE", str(tmp_path / "cache"))
    doc = cache.load("acc", "INBOX")
    doc["messages"]["2"] = {"uid": "2", "flags": ["\\Seen"], "unread": False, "subject": "a"}
    doc["messages"]["3"] = {"uid": "3", "flags": [], "unread": True, "subject": "b"}
    cache.save(doc, now=0.0)
    return "acc"


# --- batch move ---------------------------------------------------------------

def test_move_drops_moved_uids_from_cache(cached_inbox):
    fake = FakeImap()
    result = mailops.move(
        cached_inbox, uids=["2"], dest="Archive",
        build=lambda _id: _account(), imap_factory=lambda a: fake,
    )
    assert result["uids"] == ["2"]
    remaining = cache.load(cached_inbox, "INBOX")["messages"]
    assert "2" not in remaining and "3" in remaining  # D8: cache reflects the move


# --- mark (flags) -------------------------------------------------------------

def test_mark_read_updates_cache_flags(cached_inbox):
    fake = FakeImap()
    mailops.mark(
        cached_inbox, uids=["3"], read=True,
        build=lambda _id: _account(), imap_factory=lambda a: fake,
    )
    msg = cache.load(cached_inbox, "INBOX")["messages"]["3"]
    assert "\\Seen" in msg["flags"] and msg["unread"] is False  # D8


def test_mark_unread_removes_seen_in_cache(cached_inbox):
    fake = FakeImap()
    mailops.mark(
        cached_inbox, uids=["2"], read=False,
        build=lambda _id: _account(), imap_factory=lambda a: fake,
    )
    msg = cache.load(cached_inbox, "INBOX")["messages"]["2"]
    assert "\\Seen" not in msg["flags"] and msg["unread"] is True


def test_mark_star_issues_flagged_store(cached_inbox):
    fake = FakeImap()
    mailops.mark(
        cached_inbox, uids=["3"], starred=True,
        build=lambda _id: _account(), imap_factory=lambda a: fake,
    )
    assert ("uid", "STORE", "3", "+FLAGS", "(\\Flagged)") in fake.commands


def test_mark_with_no_change_is_validation_error(cached_inbox):
    with pytest.raises(ValidationError):
        mailops.mark(cached_inbox, uids=["3"], build=lambda _id: _account(),
                     imap_factory=lambda a: FakeImap())
