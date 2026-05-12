---
name: repo-structure
description: Use this skill when setting up, restructuring, documenting, or enforcing the Mango Tree repository layout for the local agent runtime, LangGraph workflows, scoped tools, tests, documentation, or web frontend.
---

# Mango Tree Repository Structure

Mango Tree is a local personal agent runtime. It should route a user request through an orchestrator, delegate broad reasoning to a general agent, and send narrow executable work to specialist LangGraph workflows with scoped tools, memory, datasets, filesystem paths, and permissions.

## Core Layout

```text
.
|-- configs/
|   |-- models.yaml
|   |-- agents.yaml
|   |-- tools.yaml
|   |-- permissions.yaml
|   `-- workflows.yaml
|-- docs/
|-- src/
|   `-- agent_runtime/
|       |-- inference/
|       |-- orchestration/
|       |-- agents/
|       |-- tools/
|       |-- memory/
|       |-- storage/
|       |-- sandbox/
|       |-- schemas/
|       `-- observability/
|-- workflows/
|-- skills/
|-- data/
|-- workspaces/
|-- tests/
`-- web/
```

## Structural Rules

- Use `uv` for Python commands and dependencies.
- Keep runtime code in `src/agent_runtime/`.
- Keep executable workflow definitions in `workflows/`.
- Keep static instruction packs in `skills/`; skills are not executable tools.
- Keep repository documentation in `docs/`.
- Keep website code, assets, routes, and frontend runtime files in `web/`.
- Keep tests grouped by subsystem and behavior, not as one large flat folder.

## Runtime Boundaries

- `orchestration/` owns graph construction, routing, state, policies, checkpoints, and events.
- `agents/` owns orchestrator, general agent, and specialist agent contracts.
- `tools/` owns registries, schemas, permission metadata, and tool implementations.
- `memory/` owns short-term memory, vector memory, repo indexes, and namespaces.
- `storage/` owns relational state, events, artifacts, repositories, and migrations.
- `sandbox/` owns command policy, mounts, network policy, and safe command execution.
- `schemas/` owns typed task, message, permission, artifact, and tool-call contracts.

## Test Layout

```text
tests/
|-- orchestration/
|-- tools/
|-- agents/
|-- workflows/
|-- memory/
`-- sandbox/
```

Tests must include denial cases for permission, path, namespace, dataset, schema, shell, and sandbox boundaries.
