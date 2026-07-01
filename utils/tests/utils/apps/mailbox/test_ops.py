"""Core IMAP write primitives: batch move, delete (soft/permanent), flags, and
well-known folder resolution (D6/D9). All offline — the IMAP client is faked."""

from __future__ import annotations

import pytest

from utils.apps.mailbox.backend.services import ops
from utils.apps.mailbox.backend.services import providers
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.errors import ProviderError, ValidationError
from utils.apps.mailbox.shared.schemas import AccountConfig


class FakeImap:
    """Records every IMAP call; advertises MOVE and a SPECIAL-USE Trash folder."""

    def __init__(self, *, with_move=True, special_use=True):
        self.with_move = with_move
        self.special_use = special_use
        self.commands: list[tuple] = []
        self.expunged = False

    def authenticate(self, mech, fn):
        fn(b"")
        self.commands.append(("auth", mech))

    def login(self, u, p):
        self.commands.append(("login", u))

    def create(self, mb):
        self.commands.append(("create", mb))
        return ("OK", [b"created"])

    def select(self, mb, readonly=False):
        self.commands.append(("select", mb, readonly))
        return ("OK", [b"3"])

    def capabilities(self):
        return [b"IMAP4REV1", b"MOVE"] if self.with_move else [b"IMAP4REV1"]

    def uid(self, cmd, *args):
        self.commands.append(("uid", cmd, *args))
        return ("OK", [b"ok"])

    def store(self, *a):
        self.commands.append(("store", *a))
        return ("OK", [b"ok"])

    def expunge(self):
        self.expunged = True
        return ("OK", [b"1"])

    def list(self, directory="", pattern="*"):
        rows = [b'(\\HasChildren) "/" "INBOX"', b'(\\Sent) "/" "[Gmail]/Sent Mail"']
        if self.special_use:
            rows.append(b'(\\Trash \\HasNoChildren) "/" "[Gmail]/Trash"')
        return ("OK", rows)

    def logout(self):
        self.commands.append(("logout",))


def _gmail() -> MailAccount:
    return MailAccount(
        "gmail", "me@gmail.com", "imap.gmail.com", 993, "smtp.gmail.com", 587,
        "oauth2", access_token="TOK",
        well_known_names={"trash": "[Gmail]/Trash", "sent": "[Gmail]/Sent Mail"},
    )


# --- batch move ---------------------------------------------------------------

def test_move_messages_batches_into_one_move_round_trip():
    fake = FakeImap(with_move=True)
    result = ops.move_messages(
        _gmail(), uids=["7", "8", "9"], source_folder="INBOX",
        dest_folder="INBOX/Work", imap_factory=lambda a: fake,
    )
    assert result == {"uids": ["7", "8", "9"], "moved_to": "INBOX/Work", "method": "MOVE"}
    assert ("uid", "MOVE", "7,8,9", "INBOX/Work") in fake.commands


def test_move_messages_falls_back_to_copy_expunge_without_move():
    fake = FakeImap(with_move=False)
    result = ops.move_messages(
        _gmail(), uids=["7"], source_folder="INBOX", dest_folder="Done",
        imap_factory=lambda a: fake,
    )
    assert result["method"] == "COPY+EXPUNGE" and fake.expunged


def test_move_messages_empty_uids_is_validation_error():
    with pytest.raises(ValidationError):
        ops.move_messages(_gmail(), uids=[], source_folder="INBOX", dest_folder="X",
                          imap_factory=lambda a: FakeImap())


# --- well-known folders -------------------------------------------------------

def test_well_known_prefers_special_use_flag():
    assert ops.well_known_folder(_gmail(), "trash",
                                 imap_factory=lambda a: FakeImap()) == "[Gmail]/Trash"


def test_well_known_falls_back_to_provider_map():
    acct = MailAccount("yahoo", "me@yahoo.com", "imap.mail.yahoo.com", 993,
                       "smtp.mail.yahoo.com", 587, "password", app_password="pw",
                       well_known_names={"trash": "Trash"})
    resolved = ops.well_known_folder(acct, "trash",
                                     imap_factory=lambda a: FakeImap(special_use=False))
    assert resolved == "Trash"


def test_well_known_unresolvable_raises():
    acct = MailAccount("exchange", "me@corp.com", "mail.corp.com", 993,
                       "mail.corp.com", 587, "either", app_password="pw")
    with pytest.raises(ValidationError):
        ops.well_known_folder(acct, "trash",
                              imap_factory=lambda a: FakeImap(special_use=False))


def test_well_known_unknown_kind_raises():
    with pytest.raises(ValidationError):
        ops.well_known_folder(_gmail(), "outbox", imap_factory=lambda a: FakeImap())


# --- delete (soft + permanent) ------------------------------------------------

def test_soft_delete_moves_to_trash_reversible():
    fake = FakeImap(with_move=True)
    result = ops.delete_message(_gmail(), uids=["9"], source_folder="INBOX",
                                imap_factory=lambda a: fake)
    assert result["permanent"] is False and result["moved_to"] == "[Gmail]/Trash"
    assert ("uid", "MOVE", "9", "[Gmail]/Trash") in fake.commands


def test_permanent_delete_stores_deleted_and_expunges():
    fake = FakeImap(with_move=True)
    result = ops.delete_message(_gmail(), uids=["9", "10"], source_folder="[Gmail]/Trash",
                                permanent=True, imap_factory=lambda a: fake)
    assert result["permanent"] is True and fake.expunged
    assert ("uid", "STORE", "9,10", "+FLAGS", "(\\Deleted)") in fake.commands


def test_permanent_delete_reports_provider_error_on_store_failure():
    class BadStore(FakeImap):
        def uid(self, cmd, *args):
            self.commands.append(("uid", cmd, *args))
            return ("NO", [b"denied"])

    with pytest.raises(ProviderError):
        ops.delete_message(_gmail(), uids=["9"], source_folder="Trash",
                           permanent=True, imap_factory=lambda a: BadStore())


# --- flags --------------------------------------------------------------------

def test_set_flags_add_and_remove():
    fake = FakeImap()
    result = ops.set_flags(_gmail(), uids=["3"], add=["\\Seen"], remove=["\\Flagged"],
                           imap_factory=lambda a: fake)
    assert result == {"uids": ["3"], "added": ["\\Seen"], "removed": ["\\Flagged"]}
    assert ("uid", "STORE", "3", "+FLAGS", "(\\Seen)") in fake.commands
    assert ("uid", "STORE", "3", "-FLAGS", "(\\Flagged)") in fake.commands


def test_set_flags_requires_a_change():
    with pytest.raises(ValidationError):
        ops.set_flags(_gmail(), uids=["3"], imap_factory=lambda a: FakeImap())


# --- registry pass-through (D6/D10) -------------------------------------------

def test_registry_seeds_well_known_and_sent_flag():
    gmail = providers.build_account_from_config(
        AccountConfig(id="g", provider="gmail", display_name="G", email="g@x.com")
    )
    assert gmail.files_sent_automatically is True
    assert gmail.well_known_names["trash"] == "[Gmail]/Trash"

    yahoo = providers.build_account_from_config(
        AccountConfig(id="y", provider="yahoo", display_name="Y", email="y@x.com")
    )
    assert yahoo.files_sent_automatically is False
    assert yahoo.well_known_names["sent"] == "Sent"


# --- reply / reply-all --------------------------------------------------------

_ORIGINAL = (
    b"From: Alice <alice@example.com>\r\n"
    b"To: bob@example.com, team@example.com\r\n"
    b"Cc: carol@example.com\r\n"
    b"Subject: Project update\r\n"
    b"Message-ID: <orig@example.com>\r\n"
    b"References: <root@example.com>\r\n"
    b"Date: Mon, 22 Jun 2026 09:00:00 +0000\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
    b"Here is the original body.\r\n"
)


class ReplyImap:
    def __init__(self, raw):
        self.raw = raw
        self.appended: list[tuple] = []

    def authenticate(self, mech, fn):
        fn(b"")

    def login(self, u, p):
        pass

    def select(self, mb, readonly=False):
        return ("OK", [b"1"])

    def uid(self, cmd, *args):
        if cmd == "FETCH":
            return ("OK", [(b"1 (UID 1 RFC822 {%d}" % len(self.raw), self.raw), b")"])
        return ("OK", [b"ok"])

    def list(self, directory="", pattern="*"):
        return ("OK", [b'(\\Sent) "/" "Sent"'])

    def append(self, mailbox, flags, date_time, message):
        self.appended.append((mailbox, flags, message))
        return ("OK", [b"ok"])

    def logout(self):
        pass


class ReplySmtp:
    def __init__(self):
        self.sent = None

    def docmd(self, cmd, arg):
        return (235, b"ok")

    def login(self, u, p):
        pass

    def send_message(self, msg, from_addr=None, to_addrs=None):
        self.sent = {"msg": msg, "from": from_addr, "to": to_addrs}
        return {}

    def quit(self):
        pass


def _reply_account(files_sent=False):
    return MailAccount("yahoo", "bob@example.com", "imap.mail.yahoo.com", 993,
                       "smtp.mail.yahoo.com", 587, "password", app_password="pw",
                       files_sent_automatically=files_sent,
                       well_known_names={"sent": "Sent"})


def test_reply_threads_quotes_and_files_to_sent():
    imap, smtp = ReplyImap(_ORIGINAL), ReplySmtp()
    result = ops.reply_message(_reply_account(), uid="1", body="Thanks!",
                               imap_factory=lambda a: imap, smtp_factory=lambda a: smtp)
    msg = smtp.sent["msg"]
    assert msg["Subject"] == "Re: Project update"
    assert msg["In-Reply-To"] == "<orig@example.com>"
    assert msg["References"] == "<root@example.com> <orig@example.com>"
    assert smtp.sent["to"] == ["alice@example.com"]        # reply target = From
    assert "> Here is the original body." in msg.get_content()  # quoted
    assert result["filed_to_sent"] is True and imap.appended[0][0] == "Sent"


def test_reply_does_not_double_prefix_re():
    raw = _ORIGINAL.replace(b"Subject: Project update", b"Subject: RE: Project update")
    imap, smtp = ReplyImap(raw), ReplySmtp()
    ops.reply_message(_reply_account(), uid="1", body="ok",
                      imap_factory=lambda a: imap, smtp_factory=lambda a: smtp)
    assert smtp.sent["msg"]["Subject"] == "RE: Project update"


def test_reply_all_adds_others_and_excludes_self():
    imap, smtp = ReplyImap(_ORIGINAL), ReplySmtp()
    ops.reply_message(_reply_account(), uid="1", body="Thanks all", reply_all=True,
                      imap_factory=lambda a: imap, smtp_factory=lambda a: smtp)
    msg = smtp.sent["msg"]
    assert msg["To"] == "alice@example.com"
    assert "team@example.com" in msg["Cc"] and "carol@example.com" in msg["Cc"]
    assert "bob@example.com" not in (msg["To"] + msg["Cc"])  # own address dropped


def test_reply_skips_sent_append_when_provider_files_it():
    gmail = MailAccount("gmail", "bob@gmail.com", "imap.gmail.com", 993,
                        "smtp.gmail.com", 587, "oauth2", access_token="TOK",
                        files_sent_automatically=True)
    imap, smtp = ReplyImap(_ORIGINAL), ReplySmtp()
    result = ops.reply_message(gmail, uid="1", body="ok",
                               imap_factory=lambda a: imap, smtp_factory=lambda a: smtp)
    assert result["filed_to_sent"] is False and imap.appended == []


def test_reply_without_recipient_raises():
    raw = b"Subject: x\r\nMessage-ID: <a@b>\r\n\r\nbody\r\n"  # no From / Reply-To
    with pytest.raises(ValidationError):
        ops.reply_message(_reply_account(), uid="1", body="hi",
                          imap_factory=lambda a: ReplyImap(raw),
                          smtp_factory=lambda a: ReplySmtp())


def test_reply_empty_body_raises():
    with pytest.raises(ValidationError):
        ops.reply_message(_reply_account(), uid="1", body="   ",
                          imap_factory=lambda a: ReplyImap(_ORIGINAL),
                          smtp_factory=lambda a: ReplySmtp())
