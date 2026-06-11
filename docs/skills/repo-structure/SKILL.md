---
name: repo-structure
description: Use this skill when setting up, restructuring, documenting, or enforcing the Mango Tree repository layout for the Django/DRF backend, LangGraph agents, modular apps under utils/apps/, tests, documentation, or React/Vite frontend.
---

# Mango Tree Repository Structure

Mango Tree is a local personal agent platform. It routes user requests through a coordinator, delegates broad reasoning to a planner, and sends narrow executable work to specialist LangGraph workflows and app-scoped tools with permissions, memory, datasets, and filesystem scopes.

## Core Layout

```text
.
|-- agents/
|   |-- coordinator/
|   |-- planner/
|   |-- memory/
|   |-- tools/
|   `-- providers/
|-- api/
|   |-- routes/
|   |-- serializers/
|   |-- middleware/
|   `-- schemas/
|-- config/
|   |-- django/
|   |-- models.yaml
|   |-- agents.yaml
|   |-- tools.yaml
|   |-- permissions.yaml
|   `-- workflows.yaml
|-- docs/
|-- utils/
|   |-- apps/
|   |   |-- projects/
|   |   |-- notes/
|   |   |-- jobs/
|   |   |-- calendar/
|   |   |-- recipes/
|   |   |-- imdbspy/
|   |   |-- exercise/
|   |   `-- timekeeper/
|   `-- shared/
|       |-- auth/
|       |-- permissions/
|       |-- storage/
|       |-- search/
|       |-- embeddings/
|       `-- events/
|-- tests/
|-- scripts/
|-- requirements/
`-- web/
```

## Structural Rules

- Use `uv` for Python commands and dependencies.
- Keep agent orchestration in `agents/`.
- Keep HTTP API surface in `api/`.
- Keep app domain code in `utils/apps/{app_name}/`.
- Keep cross-app foundations in `utils/shared/`.
- Keep static instruction packs in `docs/skills/`; skills are not executable tools.
- Keep repository documentation in `docs/`.
- Keep website code under `web/`.
- Keep tests grouped by subsystem and behavior, not as one large flat folder.

## Layer Responsibilities

### `web/`

Dashboard shell, app navigation, AI chat workspace, command palette, settings panels, and app rendering. Consumes DRF APIs only.

### `api/`

Route definitions, serializers, request validation, middleware, and app-facing endpoints. Thin layer over app services.

### `agents/`

LangGraph orchestration: coordinator routing, planner reasoning, memory access, tool routing, and model provider selection.

### `utils/apps/{app_name}/`

Domain logic, data access, services, API behavior, frontend fragments, and agent tools for one app.

### `utils/shared/`

Reusable auth, permissions, storage, search, embeddings, and event utilities shared across apps.

## App Standard

Every app under `utils/apps/{app_name}/` follows:

```text
utils/apps/{app_name}/
|-- backend/
|   |-- api/
|   |-- models/
|   |-- services/
|   `-- tasks/
|-- frontend/
|   |-- components/
|   |-- pages/
|   `-- hooks/
|-- agent/
|   |-- tools.py
|   `-- prompts.py
`-- shared/
```

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools in `agent/tools.py` call services; never duplicate domain logic.
- Frontend fragments in `frontend/` are consumed by the `web/` shell.

## Flask Migration Strategy

For apps currently implemented with Flask:

**Keep:** models, business rules, services, background jobs, utilities, API logic.

**Remove:** templates, static frontend files, page-specific routing, duplicated client-side logic.

**Reorganize into:** `utils/apps/{app_name}/backend/`, `frontend/`, and `agent/`.

## Test Layout

```text
tests/
|-- agents/
|-- api/
|-- utils/
|   |-- apps/
|   `-- shared/
`-- web/
```

Tests must include denial cases for permission, path, namespace, dataset, schema, shell, and sandbox boundaries.

## Migration Note

The previous `src/agent_runtime/` layout is retired. Map old concepts as follows:

| Retired path | New location |
| --- | --- |
| `src/agent_runtime/orchestration/` | `agents/coordinator/` |
| `src/agent_runtime/agents/general/` | `agents/planner/` |
| `src/agent_runtime/memory/` | `agents/memory/` |
| `src/agent_runtime/tools/` | `agents/tools/` |
| `src/agent_runtime/inference/` | `agents/providers/` |
| Specialist workflows | `utils/apps/{app}/agent/` |
| Permissions, sandbox, storage | `utils/shared/` |

See `docs/rebuild-plan.md` for the full rebuild reference.
