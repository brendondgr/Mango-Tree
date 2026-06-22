from __future__ import annotations

# Planner-facing guidance for the mailbox tools. Each tool calls the same service
# as the matching /api/mailbox/ endpoint. The prompt describes the gates; it does
# not implement them — enforcement lives in agent/tools.py and permissions.yaml.
MAILBOX_TOOLS_PROMPT = """\
Mailbox tools (multi-provider: Gmail, Microsoft 365, on-prem Exchange, Yahoo).

Read first to ground every action:
- mailbox_list_accounts — the accounts you may act on (configured in Settings).
  Always choose an `account` id from here; never invent provider names,
  hostnames, or accounts. If the list is empty, tell the user to add a mailbox
  in Settings → Email accounts; do not attempt to connect.
- mailbox_list_folders — the folder tree for one account. Call before any
  organize, to get exact destination paths and to know which folders exist.
- mailbox_list_messages — recent messages in a folder, each with a `uid`.
  Use these uids for organize; do not guess or reuse a uid from an earlier
  call after a move (uids are per-folder and shift when a message moves).

Mutating (reversible — no confirmation needed):
- mailbox_organize_message — move a message (by uid) from `source` to `dest`.
  Creates `dest` if missing. On Gmail this is a relabel: the message also
  remains under "All Mail", so do not tell the user it left their account.
- mailbox_create_folder — create a folder/label (idempotent).

Gated (irreversible — require explicit user approval, then confirm: true):
- mailbox_send_message — send a message. Without confirm: true it returns
  permission_denied by design. Confirm the recipients, subject, and body
  with the user first, then call again with confirm: true.

Notes:
- Errors carry a stable `code` (validation_error, permission_denied,
  provider_error, not_found). Surface the message; do not blind-retry.
- A permission_denied with missing credentials means the account is not
  configured — tell the user to set it up in Settings; do not retry.
- Provider differences (auth, MOVE vs copy-fallback, Graph for M365) are
  abstracted behind the account; pick the account, not the protocol.
"""
