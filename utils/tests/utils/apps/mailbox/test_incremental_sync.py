"""Incremental sync into the cache — fetches only new UIDs (no network)."""

from __future__ import annotations

import pytest

from utils.apps.mailbox.backend.services import cache, sync
from utils.apps.mailbox.backend.services.ops import MailAccount


@pytest.fixture(autouse=True)
def _tmp_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CACHE", str(tmp_path / "cache"))


def _raw(uid: str) -> bytes:
    return (
        b"From: Alice <a@x.com>\r\n"
        b"To: b@x.com\r\n"
        b"Subject: Message " + uid.encode() + b"\r\n"
        b"Message-ID: <" + uid.encode() + b"@x>\r\n"
        b"Date: Mon, 22 Jun 2026 09:0" + uid.encode()[:1] + b":00 +0000\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
        b"Body of " + uid.encode() + b".\r\n"
    )


class FakeImap:
    """Server with controllable UID set, flags, and UIDVALIDITY. Records which
    UIDs were fully fetched (RFC822) so a test can assert incremental behavior."""

    def __init__(self, uids, *, uidvalidity=1, seen=()):
        self.uids = list(uids)
        self.uidvalidity = uidvalidity
        self.seen = set(seen)
        self.rfc822_fetched: list[str] = []

    def authenticate(self, mech, fn):  # pragma: no cover - oauth path unused
        fn(b"")

    def login(self, user, password):
        return ("OK", [b"ok"])

    def select(self, mailbox, readonly=False):
        return ("OK", [str(len(self.uids)).encode()])

    def status(self, mailbox, names):
        return ("OK", [f"{mailbox} (UIDVALIDITY {self.uidvalidity})".encode()])

    def uid(self, command, *args):
        if command == "SEARCH":
            return ("OK", [" ".join(self.uids).encode()])
        if command == "FETCH":
            target, spec = args[0], args[1]
            if spec == "(FLAGS)":
                rows = []
                for uid in target.split(","):
                    flags = b"\\Seen" if uid in self.seen else b""
                    rows.append(b"1 (UID %s FLAGS (%s))" % (uid.encode(), flags))
                return ("OK", rows)
            # single full fetch
            uid = target
            self.rfc822_fetched.append(uid)
            raw = _raw(uid)
            flags = b"\\Seen" if uid in self.seen else b""
            envelope = b"1 (UID %s FLAGS (%s) RFC822 {%d}" % (uid.encode(), flags, len(raw))
            return ("OK", [(envelope, raw), b")"])
        return ("OK", [b"ok"])

    def logout(self):
        return ("BYE", [b"bye"])


def _account():
    return MailAccount(
        "yahoo", "b@x.com", "imap.mail.yahoo.com", 993,
        "smtp.mail.yahoo.com", 587, "password", app_password="pw",
    )


def test_first_sync_fetches_all_then_second_fetches_none():
    server = FakeImap(["1", "2", "3"])
    summary = sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: server)
    assert summary["new"] == 3 and summary["total"] == 3
    assert sorted(server.rfc822_fetched) == ["1", "2", "3"]
    assert [m["uid"] for m in cache.cached_list("acc1", "INBOX")] == ["3", "2", "1"]

    # second sync, nothing changed server-side: NO message re-fetched
    server2 = FakeImap(["1", "2", "3"])
    summary2 = sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: server2)
    assert summary2["new"] == 0
    assert server2.rfc822_fetched == []  # cache reused; whole folder not re-downloaded


def test_only_new_uid_is_fetched():
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1", "2"]))
    server = FakeImap(["1", "2", "3"])  # uid 3 is new
    summary = sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: server)
    assert summary["new"] == 1
    assert server.rfc822_fetched == ["3"]
    assert {m["uid"] for m in cache.cached_list("acc1", "INBOX")} == {"1", "2", "3"}


def test_removed_uid_is_dropped():
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1", "2", "3"]))
    summary = sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1", "3"]))
    assert summary["removed"] == 1
    assert {m["uid"] for m in cache.cached_list("acc1", "INBOX")} == {"1", "3"}


def test_uidvalidity_change_forces_full_resync():
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1", "2"]))
    server = FakeImap(["1", "2"], uidvalidity=999)  # server reset UIDs
    summary = sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: server)
    assert summary["new"] == 2  # everything re-fetched under the new validity
    assert sorted(server.rfc822_fetched) == ["1", "2"]


def test_flag_refresh_updates_unread():
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1"]))
    assert cache.cached_list("acc1", "INBOX")[0]["unread"] is True
    # same uid, now marked \\Seen on the server
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: FakeImap(["1"], seen=["1"]))
    assert cache.cached_list("acc1", "INBOX")[0]["unread"] is False


def test_initial_sync_fetches_newest_first():
    # UID SEARCH returns ascending; the sync must fetch highest-UID (newest)
    # first so recent mail tops the inbox during a long initial sync.
    server = FakeImap(["1", "2", "3", "10"])
    sync.sync_folder(_account(), account_id="acc1", imap_factory=lambda a: server)
    assert server.rfc822_fetched == ["10", "3", "2", "1"]


def test_progress_callback_reports_new_count():
    calls: list[tuple[int, int]] = []
    sync.sync_folder(
        _account(), account_id="acc1",
        imap_factory=lambda a: FakeImap(["1", "2"]),
        on_progress=lambda done, total: calls.append((done, total)),
    )
    assert calls[0] == (0, 2)
    assert calls[-1] == (2, 2)
