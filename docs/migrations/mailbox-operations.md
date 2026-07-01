# Mailbox App — Email Operations (move / delete / reply / flags)

Extends the migrated mailbox module (`utils/apps/mailbox/`) with the operations a
user actually performs on saved mail: organize into folders (batch), delete
(soft + permanent), reply / reply-all, and flag changes (read/unread, star).
Continues the diagnosis in `mailbox-diagnosis.md` and its decisions **D1–D5**.

Everything is composition on top of the move primitive that already existed
(`organize_message`) plus three genuinely new pieces — permanent delete, reply,
and flags. Enforcement stays in code (confirm gates in `agent/tools.py` and the
DRF views), never in the prompt.

## Baseline (self-tests, no network)

All offline self-tests pass, extended with the new primitives:

| Self-test | Command | Result |
| --- | --- | --- |
| Core ops (organize/send/tree **+ move/delete/flags/reply/well-known**) | `python -m utils.apps.mailbox.backend.services.ops` | OK |
| Read path (list/get/parse **+ References/Reply-To/Cc**) | `python -m utils.apps.mailbox.backend.services.sync` | OK |
| M365 Graph path | `python -m utils.apps.mailbox.backend.services.providers.m365 --selftest` | OK |

`uv run pytest utils/tests/utils/apps/mailbox/ utils/tests/api/test_mailbox.py`
is green (147 tests).

## Capability inventory (added)

- **Batch move** — `ops.move_messages` moves a UID set in one IMAP round trip,
  reusing the shared `_uid_move` (MOVE with COPY+EXPUNGE fallback) that
  `organize_message` was refactored onto.
- **Delete** — `ops.delete_message`: soft (move to the account's Trash,
  reversible) or permanent (`STORE \Deleted` + `EXPUNGE`, irreversible). On Gmail
  a soft delete moves to `[Gmail]/Trash` and strips other labels but survives in
  All Mail until permanently deleted.
- **Flags** — `ops.set_flags`: `UID STORE ±FLAGS` (mark read/unread, star).
- **Reply / reply-all** — `ops.reply_message`: threads (In-Reply-To/References,
  `Re:` subject, quoted body), computes recipients, sends via the shared
  `_smtp_send`, then files a Sent copy (D10).
- **Well-known folders** — `ops.well_known_folder`: SPECIAL-USE (RFC 6154) with a
  per-provider name-map fallback.
- **Cache consistency** — `mailops` reflects each mutation in the local cache
  (D8).

## Tool surface (frozen contract in `mailbox/README.md`)

Six tools became ten. New: `mailbox_move_messages`, `mailbox_mark_messages`,
`mailbox_delete_messages`, `mailbox_reply_message`. Each has a matching DRF route
(`/move/`, `/mark/`, `/delete/`, `/reply/`) calling the same `mailops` service
(API ↔ agent parity). The `config/tools.yaml` count test asserts exactly ten.

## Resolved decisions (D6–D11)

- **D6 — Well-known folders.** Resolve Trash/Sent/Junk/Archive/Drafts via the
  server's RFC 6154 SPECIAL-USE flags on `LIST`, then a per-provider name map
  seeded on the account by the registry. The agent never guesses a path.
- **D7 — Gating.** Reversible = ungated (move/organize, flags, soft delete);
  irreversible = confirm-gated in code (permanent delete, reply, send). The gate
  is checked in `agent/tools.py` and mirrored in the DRF views for the
  irreversible endpoints.
- **D8 — Cache consistency.** `mailops` best-effort updates the local cache on a
  successful mutation (`remove_uids` after a move/delete out of a folder,
  `update_flags` after a flag change); the next incremental sync is the source of
  truth, so a cache miss never fails the operation.
- **D9 — Batch + handle stability.** The write primitives are batch-native: a
  `uids[]` set becomes one IMAP message-set (`"1,2,5"`). UIDs are per-folder and
  shift on MOVE (D2), so a batch resolves all UIDs against one `source` folder in
  a grounded turn; `message_id` stays the stable cross-folder handle.
- **D10 — Sent copy on reply.** `reply_message` IMAP-`APPEND`s the sent copy to
  the resolved Sent folder with `\Seen`, unless `account.files_sent_automatically`
  (Gmail files it itself — skip to avoid a duplicate). The APPEND is best-effort.
- **D11 — Graph parity.** The dispatch seam is `mailops`: every mutation resolves
  an account via the registry and calls an `ops` primitive. When a Graph token
  flow lands and an account's `use_graph` flips (D3), `mailops` can dispatch to
  Graph equivalents behind the same function/tool names — Graph already has
  native `/move` (incl. `deleteditems`), `/reply`, `/replyAll`, and `PATCH`
  read-state, so no tool contract changes. Not wired now: the Graph mutation path
  stays unregistered until that token flow exists, exactly as `organize` does
  today. Microsoft is retiring IMAP/EWS for Exchange Online, so D11 is the
  medium-term home for M365 — structuring `mailops` as the seam now avoids a
  rewrite later.

## Done checklist

- [x] `ops.py`: `_uid_move` refactor; `move_messages`, `delete_message`,
      `set_flags`, `reply_message`, `well_known_folder`; expanded self-test.
- [x] `MailAccount` + registry: `files_sent_automatically`, `well_known_names`.
- [x] `sync.py`/`MessageDTO`: parse `References`, `Reply-To`, `Cc`.
- [x] `mailops.py`: `move`, `mark`, `delete`, `reply` with D8 cache updates.
- [x] `agent/tools.py`: four new tools; permanent-delete and reply confirm-gated
      in code; soft delete / move / mark ungated.
- [x] DRF views + routes: `/move/`, `/mark/`, `/delete/`, `/reply/` calling the
      same services (parity); irreversible endpoints mirror the confirm gate.
- [x] Frozen contract (`mailbox/README.md`), `agent/prompts.py`,
      `config/tools.yaml`, and the count test kept in lockstep (ten tools).
- [x] `docs/api.md` documents the four endpoints.
- [x] `config/permissions.yaml`: unchanged — same IMAP/SMTP hosts, no new scope.
- [x] Denial cases: no-confirm permanent delete, no-confirm reply (tool + API);
      credential-missing move/mark/delete/reply deny before any network.
- [x] Tests green: ops/mailops/agent-tool/api + self-tests.
