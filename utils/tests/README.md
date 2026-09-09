# Tests

Pytest suite for the backend, configured in `pyproject.toml`
(`testpaths = ["utils/tests"]`, `DJANGO_SETTINGS_MODULE = "config.django.settings"`).

```bash
uv run pytest
```

Requires the dev extra: `uv sync --extra dev`.

## Layout

```text
utils/tests/
├── agents/        # coordinator graph, LLM provider, tool groups, selection and their enforcement
├── api/           # DRF route tests, one module per app, plus health and tools
├── config/        # settings behaviour (cookie security)
├── scenarios/     # the tool-call scenario suite: every tool through the real loop (docs/tool-scenarios.md)
└── utils/
    ├── apps/      # per-app service, API, and agent tool tests
    └── shared/    # auth, events, search
```

Frontend tests are separate and live beside their source as `*.test.ts(x)`, run
with `npm test` (Vitest) from `web/`.

## What to cover

Include denial cases, not just happy paths — a disabled tool group must be
refused at execution, an unauthenticated request must be rejected, an
out-of-scope path or host must be denied, and irreversible tools must refuse
without `confirm: true`.
