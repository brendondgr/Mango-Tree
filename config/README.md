# Config

Django project configuration and the agent runtime's YAML.

| Path | Purpose |
| --- | --- |
| `django/` | `settings.py`, `urls.py`, `views.py`, `asgi.py`, `wsgi.py` |
| `artifacts.yaml` | Artifact store root, per-kind size limits, allowed kinds |
| `models.yaml` | LLM provider defaults (base URL, model) — overridden by `LLM_*` env vars |
| `permissions.yaml` | Declared filesystem and network scopes per app. Read by tests only; see `utils/shared/permissions/README.md` |
| `search.yaml` | SearXNG endpoint, result and round limits, page-fetch limits |
| `tools.yaml` | The agent tool registry: tool groups and every tool's app, module, function, and parameter schema |

There is no `agents.yaml` and no `workflows.yaml` — agent behaviour is defined in
code under `utils/agents/`, and there are no workflow manifests.

## Databases

`settings.py` configures six SQLite connections: `default`
(`.django-test.sqlite3` at the repo root) plus one per SQLite-backed app —
`exercise`, `projectmanager`, `imdbspy`, `timekeeper`, `recipes`, each under
`data/{app}/` and each overridable with a `MANGO_{APP}_DB` environment variable.
`DATABASE_ROUTERS` binds those five to their app. Only `imdbspy` uses Django-managed
models; the rest bind `managed = False` to schemas their app owns.

No PostgreSQL, pgvector, Redis, or Celery broker is configured.
