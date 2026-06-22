# Mailbox App — Diagnosis & Capability Inventory

Migration of the standalone multi-provider mailbox toolkit into the
`utils/apps/mailbox/` module. Source: the staged files under `mailboxes/`
(`mailbox_ops.py`, `mailbox_sync.py`, `provider_{gmail,m365,exchange,yahoo}.py`).

## Baseline (self-tests, no network)

All offline self-tests pass unchanged from the staged sources and from the new
module paths:

| Self-test | Command | Result |
| --- | --- | --- |
| Core ops (organize/send/tree) | `python -m utils.apps.mailbox.backend.services.ops` | OK |
| Read path (list/get/parse) | `python -m utils.apps.mailbox.backend.services.sync` | OK |
| M365 Graph path | `python -m utils.apps.mailbox.backend.services.providers.m365 --selftest` | OK |

## Capability inventory

- **4 providers**: Gmail (OAuth2), Microsoft 365 / Exchange Online (OAuth2 IMAP
  **and** Microsoft Graph), on-prem Exchange (basic/OAuth, MOVE fallback), Yahoo
  (app password).
- **IMAP/SMTP ops** (core, injectable seams): `organize_message` (MOVE with
  COPY+EXPUNGE fallback), `create_folder` (idempotent), `send_message`
  (XOAUTH2 or AUTH LOGIN), `folder_tree` (LIST → nested tree + flat), plus the
  read path `list_messages` / `get_message` (UID-keyed, decoded body).
- **1 Graph path** (M365): `graph_organize`, `graph_create_folder`, `graph_send`
  (`saveToSentItems`), `graph_tree`. Kept available but unregistered until an
  OAuth/Graph token flow exists (D3).
- **Local-file account store** (built next): `data/mailbox/accounts.json` holds
  account *settings* only.
- **Separate secret store** (built next): credentials live outside the config
  file, referenced by `credential_ref` key name.

## Resolved decisions (D1–D5)

- **D1 — Account scoping.** This codebase has no `ExecutionContext` (confirmed
  against `utils/apps/exercise/`); tools are plain functions with injectable
  services. Scoping is therefore grounded in the **config store**: `account` is
  always an id resolved by the provider registry against `accounts.json`, never a
  free-form provider/host. `mailbox_list_accounts` reads the config store.
- **D2 — Message handle stability.** `MessageDTO` carries `message_id` (RFC
  `Message-ID`) alongside `uid`; organize stays keyed on `uid` within a grounded
  turn.
- **D3 — M365 path.** IMAP now; the registry honors a future `use_graph` toggle.
  Graph tools exist in `providers/m365.py` but are not registered.
- **D4 — Send copy-to-Sent.** The IMAP send path does not APPEND to Sent
  (provider-neutral, kept simple); the Graph path sets `saveToSentItems`.
- **D5 — Secret store backend.** A `0600` `data/mailbox/secrets.json`
  (override `MANGO_MAILBOX_SECRETS`), abstract enough to swap to an OS keychain
  later. The secret never enters `accounts.json`.

## Module layout (after relocation)

```
utils/apps/mailbox/
├── agent/                      # tools.py + prompts.py (later stages)
├── backend/
│   ├── api/                    # DRF views + serializers (later stage)
│   └── services/
│       ├── ops.py              # core IMAP/SMTP: organize/send/tree/create_folder
│       ├── sync.py             # read path: list_messages/get_message/parse_rfc822
│       └── providers/
│           ├── __init__.py     # registry: build_account(id) (settings + secret)
│           ├── gmail.py  m365.py  exchange.py  yahoo.py
│       (config_store.py, secrets.py, messages.py, mailops.py added next)
├── shared/
│   ├── errors.py               # MailError + ValidationError/PermissionDenied/...
│   └── schemas.py              # AccountConfig, MessageDTO, FolderNode
└── README.md                   # frozen tool contract (later stage)
```

Reference modules mirrored: `utils/apps/exercise/` (agent tools/prompts,
injectable service seams, error/DTO conventions) and `utils/apps/media_viewer/`
(filesystem permission scope, DRF view shape).
