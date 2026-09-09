"""Mailbox tools (10): reads, reversible organize/mark/delete, gated send/reply/purge.

The IMAP/SMTP layer is the sandbox's ``FakeMail``; every scenario proves what
the tool asked the provider to do by reading ``sandbox.mail.calls``.
"""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "mailbox"]


def _acct(ctx):
    return ctx.result("mailbox_list_accounts")["accounts"][0]["id"]


def _ops(sb):
    return [c["op"] for c in sb.mail.calls]


SCENARIOS = [
    h.Scenario(
        id="mailbox.inbox_overview",
        title="Accounts, then the inbox",
        groups=G,
        prompt="What's new in my inbox?",
        notes="The account id must come from list_accounts; the inbox read follows.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "pick the account id from the configured list")),
            h.calls(h.dynamic("mailbox_list_messages", "recent INBOX messages for that account",
                              lambda ctx: {"account": _acct(ctx), "folder": "INBOX", "limit": 10},
                              check=lambda r: _assert(r["count"] == 3))),
            h.answer("Three messages: an invoice due Friday, a lunch invite, and your Strava summary."),
        ],
        live=h.LiveExpectation(required=["mailbox_list_accounts", "mailbox_list_messages"],
                               order=[("mailbox_list_accounts", "mailbox_list_messages")],
                               forbidden=["mailbox_send_message", "mailbox_delete_messages"],
                               answer_any=["invoice", "lunch", "strava"]),
    ),
    h.Scenario(
        id="mailbox.folders",
        title="Folder tree for the account",
        groups=G,
        prompt="What folders does my mailbox have?",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_list_folders", "folder tree", lambda ctx: {"account": _acct(ctx)},
                              check=lambda r: _assert("Archive" in r["flat"]))),
            h.answer("INBOX, Sent, Trash and Archive."),
        ],
        live=h.LiveExpectation(required=["mailbox_list_folders"]),
    ),
    h.Scenario(
        id="mailbox.file_invoice",
        title="Move one message into a folder (reversible, ungated)",
        groups=G,
        prompt="File the invoice email into a 'Finance' folder.",
        notes="Read accounts, folders and messages first so the uid and destination are real; organize creates the folder.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(
                h.dynamic("mailbox_list_folders", "know what exists before choosing a destination",
                          lambda ctx: {"account": _acct(ctx)}),
                h.dynamic("mailbox_list_messages", "find the invoice uid", lambda ctx: {"account": _acct(ctx)}),
            ),
            h.calls(h.dynamic("mailbox_organize_message", "single move by uid; dest is created if missing",
                              lambda ctx: {"account": _acct(ctx),
                                           "uid": find(ctx.result("mailbox_list_messages")["messages"],
                                                       subject="Invoice #4411 due Friday")["uid"],
                                           "dest": "Finance"},
                              check=lambda r: _assert(r["moved_to"] == "Finance"))),
            h.answer("Filed the invoice under Finance."),
        ],
        live=h.LiveExpectation(required=["mailbox_list_messages"],
                               order=[("mailbox_list_messages", "mailbox_organize_message"),
                                      ("mailbox_list_messages", "mailbox_move_messages")],
                               forbidden=["mailbox_delete_messages", "mailbox_send_message"]),
        verify=lambda sb: _assert(any(m.uid == "101" for m in sb.mail.messages.get("Finance", [])),
                                  "the invoice was not moved"),
    ),
    h.Scenario(
        id="mailbox.batch_archive_and_mark",
        title="Batch move, mark read/starred, create a folder",
        groups=G,
        prompt="Archive the lunch and Strava emails, mark the invoice as read and starred, and create a 'Receipts' folder.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_list_messages", "uids for all three", lambda ctx: {"account": _acct(ctx)})),
            h.calls(
                h.dynamic("mailbox_move_messages", "batch form: one round trip for two uids",
                          lambda ctx: {"account": _acct(ctx), "uids": ["102", "103"], "dest": "Archive"}),
                h.dynamic("mailbox_mark_messages", "tri-state flags: read and starred both set",
                          lambda ctx: {"account": _acct(ctx), "uids": ["101"], "read": True, "starred": True},
                          check=lambda r: _assert(set(r["added"]) == {"\\Seen", "\\Flagged"})),
                h.dynamic("mailbox_create_folder", "idempotent create", lambda ctx: {"account": _acct(ctx), "name": "Receipts"},
                          check=lambda r: _assert(r["created"] is True)),
            ),
            h.answer("Archived two messages, marked the invoice read and starred, and created Receipts."),
        ],
        live=h.LiveExpectation(required=["mailbox_mark_messages", "mailbox_create_folder"],
                               forbidden=["mailbox_delete_messages", "mailbox_send_message"]),
        verify=lambda sb: _assert("Receipts" in sb.mail.folders and len(sb.mail.messages["Archive"]) == 2),
    ),
    h.Scenario(
        id="mailbox.soft_delete_ungated",
        title="Trash is reversible, so no confirmation is needed",
        groups=G,
        prompt="Delete the Strava summary email.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_list_messages", "find the uid", lambda ctx: {"account": _acct(ctx)})),
            h.calls(h.dynamic("mailbox_delete_messages", "soft delete -> Trash; reversible so ungated",
                              lambda ctx: {"account": _acct(ctx), "uids": ["103"]},
                              check=lambda r: _assert(r["permanent"] is False and r["moved_to"] == "Trash"))),
            h.answer("Moved the Strava summary to Trash."),
        ],
        live=h.LiveExpectation(required=["mailbox_delete_messages"], forbidden=["mailbox_send_message"]),
        verify=lambda sb: _assert(any(m.uid == "103" for m in sb.mail.messages["Trash"])),
    ),
    h.Scenario(
        id="mailbox.permanent_delete_requires_confirm",
        title="Expunge without approval is refused",
        groups=G,
        prompt="Permanently delete the lunch email, skip the trash.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_delete_messages", "permanent without approval -> permission_denied",
                              lambda ctx: {"account": _acct(ctx), "uids": ["102"], "permanent": True},
                              expect=h.DENIED_CONFIRM)),
            h.answer("Permanent deletion cannot be undone. Confirm?"),
        ],
        live=h.LiveExpectation(answer_any=["confirm", "sure", "permanent", "cannot be undone", "go ahead"]),
        verify=lambda sb: _assert(any(m.uid == "102" for m in sb.mail.messages["INBOX"]), "message was expunged"),
    ),
    h.Scenario(
        id="mailbox.permanent_delete_after_approval",
        title="Expunge after approval",
        groups=G,
        history=approved("Permanently delete the lunch email.", "That cannot be undone. Delete it permanently?"),
        prompt="Yes.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_delete_messages", "approved -> confirm: true",
                              lambda ctx: {"account": _acct(ctx), "uids": ["102"], "permanent": True, "confirm": True},
                              check=lambda r: _assert(r["permanent"] is True))),
            h.answer("Permanently deleted the lunch email."),
        ],
        live=h.LiveExpectation(required=["mailbox_delete_messages"]),
        verify=lambda sb: _assert(not any(m.uid == "102" for f in sb.mail.messages.values() for m in f)),
    ),
    h.Scenario(
        id="mailbox.send_requires_confirm",
        title="Sending without approval is refused",
        groups=G,
        prompt="Email sam@example.com saying I'm in for tacos on Thursday.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the sending account")),
            h.calls(h.dynamic("mailbox_send_message", "draft goes to the gate without confirm",
                              lambda ctx: {"account": _acct(ctx), "to": ["sam@example.com"],
                                           "subject": "Re: Team lunch on Thursday?", "body": "I'm in for tacos!"},
                              expect=h.DENIED_CONFIRM)),
            h.answer("Here is the draft to sam@example.com. Send it?"),
        ],
        live=h.LiveExpectation(answer_any=["send", "confirm", "draft", "go ahead"]),
        verify=lambda sb: _assert("send" not in _ops(sb), "a message was sent without approval"),
    ),
    h.Scenario(
        id="mailbox.send_after_approval",
        title="Send after approval",
        groups=G,
        history=approved("Email sam@example.com saying I'm in for tacos on Thursday.",
                         "Draft: To sam@example.com, subject 'Tacos Thursday', body 'I'm in for tacos!'. Send it?"),
        prompt="Yes, send it.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the sending account")),
            h.calls(h.dynamic("mailbox_send_message", "approved -> confirm: true",
                              lambda ctx: {"account": _acct(ctx), "to": ["sam@example.com"],
                                           "subject": "Tacos Thursday", "body": "I'm in for tacos!", "confirm": True},
                              check=lambda r: _assert(r["sent"] is True))),
            h.answer("Sent."),
        ],
        live=h.LiveExpectation(required=["mailbox_send_message"]),
        verify=lambda sb: _assert(_ops(sb).count("send") == 1 and sb.mail.calls[-1]["to"] == ["sam@example.com"]),
    ),
    h.Scenario(
        id="mailbox.reply_flow",
        title="Reply: read the original, refused without approval, sent after",
        groups=G,
        history=approved("Reply to Sam's lunch email: 'Tacos it is, see you Thursday.'",
                         "Replying to 'Team lunch on Thursday?' with 'Tacos it is, see you Thursday.' Send it?"),
        prompt="Send it.",
        notes="Both the denial (no confirm) and the approved send are exercised in one turn to prove the gate sits in the tool.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account")),
            h.calls(h.dynamic("mailbox_list_messages", "open the original so the reply threads correctly",
                              lambda ctx: {"account": _acct(ctx)})),
            h.calls(h.dynamic("mailbox_reply_message", "a reply without confirm is refused even after approval text",
                              lambda ctx: {"account": _acct(ctx), "uid": "102", "body": "Tacos it is, see you Thursday."},
                              expect=h.DENIED_CONFIRM)),
            h.calls(h.dynamic("mailbox_reply_message", "approved -> confirm: true",
                              lambda ctx: {"account": _acct(ctx), "uid": "102", "body": "Tacos it is, see you Thursday.",
                                           "confirm": True},
                              check=lambda r: _assert(r["in_reply_to"] == "<lunch-1@example>"))),
            h.answer("Replied to Sam."),
        ],
        live=h.LiveExpectation(required=["mailbox_reply_message"], forbidden=["mailbox_send_message"]),
        verify=lambda sb: _assert(_ops(sb).count("reply") == 1),
    ),
    h.Scenario(
        id="mailbox.unknown_account",
        title="An invented account id is a typed not_found",
        groups=G,
        prompt="List the inbox for account acc_made_up.",
        turns=[
            h.calls(h.call("mailbox_list_messages", "account ids must come from list_accounts; this one is invented",
                           account="acc_made_up", expect=h.error("not_found"))),
            h.answer("There is no account acc_made_up; your configured account is Scenario Work."),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
