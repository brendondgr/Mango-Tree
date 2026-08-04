# Utils Shared

Cross-app foundations shared by modules under `utils/apps/`.

| Directory | State | Role |
| --- | --- | --- |
| `auth/` | implemented | Django app `mango_auth` — single-owner signup/login, session cookies, per-IP lockout, login audit log |
| `search/` | implemented | SearXNG client, page fetcher, and the research loop behind the `search_web` tool |
| `llm/` | implemented | `LlmConfig` loader plus a non-streaming OpenAI-compatible client (the agent loop uses `utils/agents/providers/llm.py` instead) |
| `events/` | partial | `trace.py` appends artifact operations to `{artifacts_root}/events.jsonl`. Artifacts only — not a general event system |
| `permissions/` | **empty placeholder** | No code. See below |
| `storage/` | **empty placeholder** | No code. All storage is local filesystem under `data/` |
| `embeddings/` | **empty placeholder** | No code. No pgvector anywhere in the repo |

## About permissions

`config/permissions.yaml` declares filesystem and network scopes per app, but no
runtime code loads it — it is read only by tests, which assert that the
hardcoded paths and hosts used by app services match what the file declares.

The access controls that actually run are:

- **Tool groups** — `utils/agents/tools/` gates every app tool behind a
  session-enabled group, at both schema-assembly and execution time.
- **DRF authentication** — `IsAuthenticated` is the project-wide default; only
  health and the public auth routes opt out.
- **Per-tool confirmation** — irreversible mailbox tools (send, reply, permanent
  delete) require `confirm: true` and are hand-written in that app's
  `agent/tools.py`.

There is no shared `ExecutionContext` class. Do not reference one.
