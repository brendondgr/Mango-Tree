# Tests

Automated tests grouped by layer and concern.

## Layout

```text
tests/
├── agents/          # Coordinator, planner, memory, tools
├── api/             # DRF routes and serializers
├── utils/
│   ├── apps/        # Per-app service, API, and agent tool tests
│   └── shared/      # Auth, permissions, storage tests
└── web/             # Frontend tests (when React/Vite scaffold exists)
```

Tests must include denial cases for permission, path, namespace, dataset, schema, shell, and sandbox boundaries.

See the Testing section in `docs/platform.md`.
