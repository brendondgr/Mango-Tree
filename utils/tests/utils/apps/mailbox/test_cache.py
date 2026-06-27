"""Unit tests for the local message cache (no network)."""

from __future__ import annotations

import pytest

from utils.apps.mailbox.backend.services import cache


@pytest.fixture(autouse=True)
def _tmp_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CACHE", str(tmp_path / "cache"))


def _dto(uid: str, ts: float, *, seen: bool = False) -> dict:
    return {
        "uid": uid,
        "message_id": f"<{uid}@x>",
        "provider": "gmail",
        "account": "a@x.com",
        "subject": f"Subject {uid}",
        "from": "Alice <a@x.com>",
        "to": "b@x.com",
        "date": "Mon, 22 Jun 2026 09:00:00 +0000",
        "timestamp": ts,
        "snippet": "hello",
        "flags": ["\\Seen"] if seen else [],
        "unread": not seen,
        "body_text": None,
        "body_html": None,
    }


def test_empty_load_has_default_shape():
    doc = cache.load("acc1", "INBOX")
    assert doc["messages"] == {} and doc["bodies"] == {}
    assert doc["uidvalidity"] is None


def test_upsert_save_and_sorted_newest_first():
    doc = cache.load("acc1", "INBOX")
    cache.upsert_message(doc, _dto("1", 100.0))
    cache.upsert_message(doc, _dto("2", 300.0))
    cache.upsert_message(doc, _dto("3", 200.0))
    cache.save(doc, now=1.0)

    listed = cache.cached_list("acc1", "INBOX")
    assert [m["uid"] for m in listed] == ["2", "3", "1"]  # newest timestamp first
    assert cache.cached_list("acc1", "INBOX", limit=2) == listed[:2]


def test_remove_and_reset():
    doc = cache.load("acc1", "INBOX")
    cache.upsert_message(doc, _dto("1", 100.0))
    cache.upsert_message(doc, _dto("2", 200.0))
    cache.remove_uids(doc, {"1"})
    assert cache.cached_uids(doc) == {"2"}
    cache.reset_messages(doc, uidvalidity=42)
    assert cache.cached_uids(doc) == set()
    assert doc["uidvalidity"] == 42


def test_update_flags_toggles_unread():
    doc = cache.load("acc1", "INBOX")
    cache.upsert_message(doc, _dto("1", 100.0, seen=False))
    assert doc["messages"]["1"]["unread"] is True
    cache.update_flags(doc, "1", ["\\Seen"])
    assert doc["messages"]["1"]["unread"] is False


def test_body_cache_roundtrip():
    cache.set_body("acc1", "INBOX", "7", body_text="hi", body_html="<p>hi</p>", now=2.0)
    body = cache.get_body("acc1", "INBOX", "7")
    assert body == {"body_text": "hi", "body_html": "<p>hi</p>"}
    assert cache.get_body("acc1", "INBOX", "999") is None


def test_separate_files_per_account_and_folder():
    d1 = cache.load("acc1", "INBOX")
    cache.upsert_message(d1, _dto("1", 1.0))
    cache.save(d1, now=1.0)
    d2 = cache.load("acc2", "INBOX")
    cache.upsert_message(d2, _dto("9", 9.0))
    cache.save(d2, now=1.0)
    assert [m["uid"] for m in cache.cached_list("acc1", "INBOX")] == ["1"]
    assert [m["uid"] for m in cache.cached_list("acc2", "INBOX")] == ["9"]
    assert cache.cached_list("acc1", "Sent") == []
