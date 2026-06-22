"""Stage 4 verification: account-id read/write orchestration (messages + mailops).

The account resolver (``build``) and the IMAP/SMTP seams are injected, so the
full flow — resolve account id -> connect -> list/open/organize/create/send — runs
offline with no live server and no stored credentials.
"""

from __future__ import annotations

from utils.apps.mailbox.backend.services import mailops, messages
from utils.apps.mailbox.backend.services.ops import MailAccount

RAW = (
    b"From: Alice <a@x.com>\r\n"
    b"To: b@x.com\r\n"
    b"Subject: Quarterly report\r\n"
    b"Message-ID: <m1@x>\r\n"
    b"Date: Mon, 22 Jun 2026 09:00:00 +0000\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
    b"Here is the body of the message.\r\n"
)


class FakeImap:
    def __init__(self, with_move=True):
        self.with_move = with_move
        self.commands: list[tuple] = []
        self.expunged = False

    def authenticate(self, mech, fn):
        fn(b"")

    def login(self, user, password):
        self.commands.append(("login", user))

    def select(self, mailbox, readonly=False):
        self.commands.append(("select", mailbox, readonly))
        return ("OK", [b"2"])

    def capabilities(self):
        return [b"IMAP4REV1", b"MOVE"] if self.with_move else [b"IMAP4REV1"]

    def create(self, mailbox):
        self.commands.append(("create", mailbox))
        return ("OK", [b"created"])

    def expunge(self):
        self.expunged = True
        return ("OK", [b"1"])

    def list(self, directory="", pattern="*"):
        return ("OK", [b'(\\HasChildren) "/" "INBOX"', b'(\\Sent) "/" "Sent"'])

    def uid(self, command, *args):
        self.commands.append(("uid", command, *args))
        if command == "SEARCH":
            return ("OK", [b"1 2"])
        if command == "FETCH":
            uid = args[0].encode()
            envelope = b"%s (UID %s FLAGS (\\Seen) RFC822 {%d}" % (uid, uid, len(RAW))
            return ("OK", [(envelope, RAW), b")"])
        return ("OK", [b"ok"])

    def logout(self):
        pass


class FakeSmtp:
    def __init__(self):
        self.authed = None

    def login(self, user, password):
        self.authed = ("LOGIN", user)

    def send_message(self, msg, from_addr=None, to_addrs=None):
        return {}

    def quit(self):
        pass


def _account(cred=True):
    return MailAccount(
        "yahoo", "b@x.com", "imap.mail.yahoo.com", 993,
        "smtp.mail.yahoo.com", 587, "password",
        app_password="pw" if cred else None,
    )


def _build(_account_id):
    return _account()


# --- reads --------------------------------------------------------------------

def test_list_messages_orchestration_newest_first():
    items = messages.list_messages("acc1", build=_build, imap_factory=lambda a: FakeImap())
    assert len(items) == 2
    assert items[0].uid == "2"  # newest first
    payload = items[0].to_dict()
    assert payload["subject"] == "Quarterly report"
    assert payload["message_id"] == "<m1@x>"
    assert payload["unread"] is False  # \\Seen present


def test_get_message_returns_decoded_body():
    msg = messages.get_message("acc1", uid="2", build=_build, imap_factory=lambda a: FakeImap())
    assert msg.body_text.startswith("Here is the body")


def test_list_folders_orchestration():
    tree = messages.list_folders("acc1", build=_build, imap_factory=lambda a: FakeImap())
    paths = {f["path"] for f in tree["flat"]}
    assert {"INBOX", "Sent"} <= paths


# --- mutations ----------------------------------------------------------------

def test_organize_uses_move_when_supported():
    result = mailops.organize(
        "acc1", uid="2", dest="Archive", build=_build,
        imap_factory=lambda a: FakeImap(with_move=True),
    )
    assert result["method"] == "MOVE"
    assert result["moved_to"] == "Archive"


def test_create_folder_orchestration():
    result = mailops.create_folder(
        "acc1", name="Receipts", build=_build, imap_factory=lambda a: FakeImap()
    )
    assert result["folder"] == "Receipts"


def test_send_orchestration():
    result = mailops.send(
        "acc1", to=["c@x.com"], subject="Hi", body="hello",
        build=_build, smtp_factory=lambda a: FakeSmtp(),
    )
    assert result["sent"] is True
    assert result["accepted"] == ["c@x.com"]
