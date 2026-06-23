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
short-lived access tokens on demand (`backend/services/oauth/`).

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
| `mailbox_create_folder` | `account`, `name` | `{folder, created}` | mutating | none |
| `mailbox_send_message` | `account`, `to[]`, `subject`, `body`, `cc[]?`, `html?`, `confirm=false` | `{sent, accepted[], refused[]}` | irreversible | **`confirm: true`** |

- `account` is an **account id** resolved against the config store by the provider
  registry. `mailbox_list_accounts` reads from the config store, never env, and
  returns only configured accounts.
- `mailbox_organize_message` is mutating but reversible, so it is not gated;
  `mailbox_send_message` is irreversible and **is** gated.
- Every tool can return the platform error envelope with a stable `code`
  (`validation_error`, `permission_denied`, `provider_error`, `not_found`).

**Enforcement is in code, never in the prompt.** The confirm gate is checked in
`tools.py`; account scoping and network/filesystem scope are enforced by the
registry + `config/permissions.yaml`.

## Resolved decisions (D1–D5)

- **D1 — Account scoping.** No `ExecutionContext` exists in this codebase; tools
  are plain functions with injectable services. `account` is always an id
  resolved against `accounts.json` via the registry — a caller can only touch
  configured accounts.
- **D2 — Message handles.** `MessageDTO` carries `message_id` alongside `uid`;
  organize stays keyed on `uid` within a grounded turn (UIDs shift on MOVE).
- **D3 — M365 path.** IMAP now; the registry honors a future `use_graph` toggle.
  Graph tools exist in `providers/m365.py` but are not registered.
- **D4 — Send copy-to-Sent.** The IMAP send path does not APPEND to Sent
  (provider-neutral); the Graph path sets `saveToSentItems`.
- **D5 — Secret store.** A `0600` `data/mailbox/secrets.json`, with an interface
  small enough to later swap to an OS keychain. The secret never enters
  `accounts.json`.

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

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Secrets never enter `accounts.json` or any API/list response.

See `docs/skills/app-modules/`.
