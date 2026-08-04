# Mailbox

Domain app module under `utils/apps/mailbox/`. A multi-provider mailbox (Gmail,
Microsoft 365, on-prem Exchange, Yahoo) ported from a standalone IMAP/SMTP +
Graph toolkit. Configure accounts in-app; read, organize, and send mail from the
agent or the API.

## Layout

```text
utils/apps/mailbox/
├── backend/
│   ├── api/          # DRF views + serializers (thin)
│   └── services/
│       ├── ops.py            # core IMAP/SMTP: organize / send / folder_tree
│       ├── sync.py           # read path: list_messages / get_message / parse
│       ├── config_store.py   # account SETTINGS (data/mailbox/accounts.json)
│       ├── secrets.py        # credentials (0600 data/mailbox/secrets.json)
│       ├── messages.py       # account-id read orchestration
│       ├── mailops.py        # account-id mutation orchestration
│       └── providers/        # registry (build_account) + per-provider modules
├── frontend/         # React inbox + settings, consumed via the @mailbox alias
├── agent/            # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/           # AccountConfig/MessageDTO/FolderNode + typed errors
```

## Data stores (local-first)

Account **settings** persist to `data/mailbox/accounts.json` (override
`MANGO_MAILBOX_CONFIG`); **credentials** persist to a `0600`
`data/mailbox/secrets.json` (override `MANGO_MAILBOX_SECRETS`), referenced from
settings only by a `credential_ref` key name. Both are gitignored. The config
file never holds a secret (the store strips secret-shaped keys, asserted by test).

## OAuth sign-in (Gmail / Microsoft 365)

Thunderbird-style portal flow — the user clicks **Connect**, signs in on the
provider's own page, and lands back with a self-refreshing connection. We never
see the password; we persist only the long-lived **refresh token** and mint
short-lived access tokens on demand (`backend/services/oauth/`). The refresh
itself is delegated to the official libraries — `google-auth` (Gmail) and `msal`
(M365) — via per-provider minters in `oauth/tokens.py`, not a hand-rolled POST.

```text
Add → Connect → GET /oauth/start (authorize URL, PKCE+state)
   → provider login/consent → GET /oauth/callback (?code&state)
   → exchange code → store refresh token → upsert account → back to the SPA
```

One-time setup: register an OAuth app per provider (Google Cloud / Microsoft
Entra), set the redirect URI to `<host>/api/mailbox/oauth/callback/`, and put the
client id/secret in the environment:

| Env var | Provider |
| --- | --- |
| `OAUTH_GMAIL_CLIENT_ID` / `OAUTH_GMAIL_CLIENT_SECRET` | Gmail (restricted scope `mail.google.com`; verification + CASA before public release) |
| `OAUTH_M365_CLIENT_ID` / `OAUTH_M365_CLIENT_SECRET` | Microsoft 365 (some tenants need admin consent) |
| `MANGO_MAILBOX_OAUTH_REDIRECT` | optional exact redirect URI override |
| `MANGO_MAILBOX_OAUTH_RETURN` | optional SPA URL to return to (e.g. `/chat`) |

Yahoo is excluded from the portal (its IMAP OAuth is not self-serve) and uses an
app password; on-prem Exchange uses basic auth (host/port + app password), or its
org's modern-auth endpoints when configured. A dead refresh token surfaces as
`permission_denied` (action `reauthorize`) → the UI's one-click **Reconnect**.

## Agent tool contract (frozen)

Single source of truth. `agent/tools.py`, `agent/prompts.py`, and
`config/tools.yaml` derive from this table and must not drift.

| Tool name | Args | Returns | Kind | Gate |
| --- | --- | --- | --- | --- |
| `mailbox_list_accounts` | — | `{accounts: [{id, provider, email, display_name, enabled}]}` | read | none |
| `mailbox_list_folders` | `account` | `{tree, flat, count}` | read | none |
| `mailbox_list_messages` | `account`, `folder="INBOX"`, `limit=25` | `{messages: [MessageDTO], count}` | read | none |
| `mailbox_organize_message` | `account`, `uid`, `source="INBOX"`, `dest`, `create_if_missing=true` | `{uid, moved_to, method}` | mutating | none (reversible) |
| `mailbox_move_messages` | `account`, `uids[]`, `dest`, `source="INBOX"`, `create_if_missing=true` | `{uids, moved_to, method}` | mutating | none (reversible) |
| `mailbox_mark_messages` | `account`, `uids[]`, `read?`, `starred?`, `source="INBOX"` | `{uids, added, removed}` | mutating | none (reversible) |
| `mailbox_delete_messages` | `account`, `uids[]`, `source="INBOX"`, `permanent=false`, `confirm=false` | `{uids, deleted, permanent, moved_to?, method?}` | mutating / irreversible | **`confirm: true` only when `permanent`** |
| `mailbox_create_folder` | `account`, `name` | `{folder, created}` | mutating | none |
| `mailbox_send_message` | `account`, `to[]`, `subject`, `body`, `cc[]?`, `html?`, `confirm=false` | `{sent, accepted[], refused[]}` | irreversible | **`confirm: true`** |
| `mailbox_reply_message` | `account`, `uid`, `body`, `html?`, `reply_all=false`, `source="INBOX"`, `confirm=false` | `{sent, replied_to, to[], cc[], subject, filed_to_sent}` | irreversible | **`confirm: true`** |

- `account` is an **account id** resolved against the config store by the provider
  registry. `mailbox_list_accounts` reads from the config store, never env, and
  returns only configured accounts.
- `mailbox_organize_message`/`mailbox_move_messages`/`mailbox_mark_messages` and
  soft `mailbox_delete_messages` are reversible, so they are not gated;
  `mailbox_send_message`, `mailbox_reply_message`, and **permanent**
  `mailbox_delete_messages` are irreversible and **are** gated on `confirm: true`.
- Every tool can return the platform error envelope with a stable `code`
  (`validation_error`, `permission_denied`, `provider_error`, `not_found`).

**Enforcement is in code, never in the prompt.** The confirm gate is checked in
`tools.py`; account scoping and network/filesystem scope are enforced by the
registry + `config/permissions.yaml`.

## Resolved decisions (D1–D11)

- **D1 — Account scoping.** No `ExecutionContext` exists in this codebase; tools
  are plain functions with injectable services. `account` is always an id
  resolved against `accounts.json` via the registry — a caller can only touch
  configured accounts.
- **D2 — Message handles.** `MessageDTO` carries `message_id` alongside `uid`;
  organize stays keyed on `uid` within a grounded turn (UIDs shift on MOVE).
- **D3 — M365 path.** IMAP now; the registry honors a future `use_graph` toggle.
  Graph tools exist in `providers/m365.py` but are not registered.
- **D4 — Send copy-to-Sent.** The bare IMAP `send_message` does not APPEND to
  Sent (provider-neutral); the Graph path sets `saveToSentItems`. Replies do file
  a copy — see D10.
- **D5 — Secret store.** A `0600` `data/mailbox/secrets.json`, with an interface
  small enough to later swap to an OS keychain. The secret never enters
  `accounts.json`.
- **D6 — Well-known folders.** Trash/Sent/Junk/Archive/Drafts names vary per
  provider. `ops.well_known_folder(account, kind)` prefers the server's RFC 6154
  SPECIAL-USE flags from the `LIST` response, then falls back to a per-provider
  name map seeded on the account by the registry — the agent never guesses paths.
- **D7 — Gating.** Reversible = ungated, irreversible = confirm-gated in code.
  Move/organize, flag changes, and soft delete (a move to Trash you can undo) are
  ungated; permanent delete and reply/send are confirm-gated. On Gmail, "delete"
  moves to `[Gmail]/Trash` and strips other labels but the message survives in
  All Mail until a permanent delete.
- **D8 — Cache consistency.** `mailops` best-effort updates the local cache on a
  successful mutation (`cache.remove_uids` after a move/delete out of a folder,
  `cache.update_flags` after a flag change) so a user-driven change shows up
  immediately; the next incremental sync stays the source of truth.
- **D9 — Batch + handle stability.** The write primitives are batch-native: they
  take a `uids[]` set and issue one IMAP round trip (`"1,2,5"`). UIDs are
  per-folder and shift on MOVE (D2), so a batch resolves all UIDs against one
  `source` folder within a grounded turn; `message_id` remains the stable
  cross-folder handle.
- **D10 — Sent copy on reply.** `reply_message` fetches the original to thread
  correctly (`In-Reply-To`/`References`, `Re:` subject, quoted body) and to
  compute recipients (reply → original `Reply-To`/`From`; reply-all → also its
  `To`+`Cc` minus the account's own address). After sending, it IMAP-`APPEND`s
  the copy to the resolved Sent folder with `\Seen`, **unless**
  `account.files_sent_automatically` (Gmail files it itself, so we skip to avoid a
  duplicate). The APPEND is best-effort — a failed file-to-Sent never fails the
  reply.
- **D11 — Graph parity.** `mailops` is the dispatch seam: every mutation resolves
  an account via the registry, then calls an `ops` primitive. When a Graph token
  flow lands and an account's `use_graph` flips (D3), `mailops` can dispatch to
  Graph equivalents behind the same tool names (Graph has native move/reply/
  replyAll and `PATCH` read-state), with no contract change. Not wired yet — the
  Graph mutation path stays unregistered until that flow exists, like `organize`
  today.

## HTTP API

Base prefix `/api/mailbox/`. Documented in `docs/api.md` under **Mailbox**. DRF
routes: `utils/api/routes/mailbox.py`. Views call `backend/services/` only —
the same services the agent tools call (API ↔ agent parity). CRUD returns
settings only; the credential endpoint is write-only.

## Frontend

Imported by `web/` via the `@mailbox` Vite alias. The API client is
`web/src/services/mailboxClient.ts`; data fetching uses TanStack Query hooks in
`frontend/hooks/useMailbox.ts`. The UI opens as a **persistent workspace tab**
(the Mail icon on the chat nav rail), between Artifacts and Exercise. The inbox
offers Compact and Modern density modes, per-account/provider differentiation,
and click-to-open message reading; Settings manages accounts.

**Differentiation.** Accounts and messages are told apart by each provider's
brand logo (`frontend/components/ProviderIcon.tsx`) inside a colored outline
ring — not colored dots.

**Ordering & volume.** Messages merge across accounts sorted by the parsed
`timestamp` (newest first), and the inbox loads the whole folder by default
(`limit=all`); the load count is configurable.

**Local cache + incremental sync.** The folder is downloaded once into a local
cache (`backend/services/cache.py`, files under `data/mailbox/cache/`) keyed by
IMAP UID. After that, `sync.sync_folder` only fetches *new* UIDs (cheap
`UID SEARCH ALL` diff against the cache), drops removed ones, and batch-refreshes
flags — the inbox never re-downloads everything. Bodies are cached lazily on
first open. New UIDs are fetched newest-first so recent mail appears at the top
during a long initial sync. The `GET messages` endpoint serves the cache (no
network); `POST /sync/` runs the sync in a background thread
(`backend/services/syncrunner.py`) and reports `processed/total/new` progress via
a status sidecar file. The frontend triggers an incremental sync on open and
every 10s while the inbox is visible (`useMailboxAutoSync`), shows progress in
the toolbar, and polls faster while syncing. Single-process assumption: the
dedupe set is per worker; the cache/status files are shared.

**Email rendering.** `frontend/components/EmailBody.tsx` + `utils/renderEmail.ts`
render HTML mail in a locked-down sandboxed iframe (no scripts, no same-origin)
after sanitizing it (scripts, event handlers and `javascript:` URLs removed).
Remote images and external CSS are **blocked until the user clicks Display
content** — the permission gate for potentially harmful/tracking content.
Text-only bodies are stripped of invisible spacer characters and linkified.

**Customization (persistent).** A non-modal Customize drawer
(`CustomizePanel.tsx`) docked to the right of the inbox controls field
show/hide, text size, row tightness, per-section column widths
(From/Title/Description), list width, and the load limit — the inbox stays
visible and updates live as the controls change. These live in `mailboxPrefs` on
the workspace store and persist to `localStorage`, surviving sessions. Compact
mode spans the full screen width with the section widths applied; Modern mode
uses the configurable list-column width.

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Secrets never enter `accounts.json` or any API/list response.

See `docs/skills/app-modules/`.
