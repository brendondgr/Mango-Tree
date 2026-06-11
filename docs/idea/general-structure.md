# General Structure

This project is structured as a local agent platform: a system that routes user requests through a coordinator, delegates broad work to a planner, and sends narrow tasks to specialist LangGraph workflows and app-scoped tools with permissions, memory, datasets, and filesystem scopes.

The architecture avoids one large agent with every tool loaded at once. Each agent or workflow receives only the tools, state, paths, datasets, and memory namespaces needed for its task.

## Platform Shape

```text
User
  |
  v
web/ (React/Vite SPA)
  -> api/ (DRF)
  -> utils/apps/{app}/backend/services/
  |
  v
agents/coordinator
  - classifies the request
  - selects the workflow or app tool
  - builds a scoped task package
  - validates structured results
  |
  v
agents/planner
  - handles broad reasoning
  - performs light inspection
  - creates plans
  - delegates specific work
  |
  v
App Specialist Workflows + Tools
  - utils/apps/{app}/agent/tools.py
  - utils/apps/{app}/backend/services/
```

The coordinator is the dispatcher, not the worker. The planner is the flexible assistant, but it should not become an unrestricted executor. App specialists are constrained workers with narrow input schemas, output schemas, tool bundles, memory access, and filesystem permissions.

## Repository Layout

```text
Mango/
|-- web/                    # React/Vite SPA
|-- agents/                 # LangGraph orchestration
|   |-- coordinator/
|   |-- planner/
|   |-- memory/
|   |-- tools/
|   `-- providers/
|-- api/                    # DRF route surface
|-- config/                 # Django settings and runtime YAML
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
|-- docs/
|-- tests/
|-- scripts/
`-- requirements/
```

Each app under `utils/apps/{app_name}/` follows:

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

## Subsystems

### Providers (`agents/providers/`)

The provider layer hides the local model backend behind a small adapter. The rest of the platform does not assume an OpenAI-compatible API.

```python
class BaseLLMClient:
    def complete(self, messages, *, temperature=0.0, max_tokens=None):
        raise NotImplementedError

    def complete_json(self, messages, schema):
        raise NotImplementedError

    def complete_with_tools(self, messages, tools):
        raise NotImplementedError
```

`LocalLLMClient` (Llama-CPP) and cloud provider clients render prompts, call backends, parse tool calls, and validate structured output.

### Coordinator (`agents/coordinator/`)

The coordinator owns graph construction, task state, route selection, checkpoints, policy loading, and event recording.

Routing happens in two stages:

1. Deterministic rules for obvious requests.
2. A small LLM router that returns a validated route object when rules are not enough.

Routes come from workflow and agent registries in `config/`, not hardcoded prompt text.

### Planner (`agents/planner/`)

The planner handles broad reasoning, lightweight inspection, planning, and delegation. It has a separate state schema from the coordinator and specialists.

### Tools (`agents/tools/` + `utils/apps/{app}/agent/`)

Tools are executable capabilities registered with descriptions, schemas, permission requirements, and implementation references.

Platform tools live in `agents/tools/`. App-specific tools live in `utils/apps/{app}/agent/tools.py` and delegate to app services.

Tool bundles group capabilities:

```yaml
bundles:
  read_only_repo:
    tools:
      - list_dir
      - read_file
      - search_files
    permissions:
      - filesystem.read
```

The tool layer must enforce access. The model can request access, but it cannot be trusted to self-enforce restrictions.

### Memory And Datasets (`agents/memory/` + `utils/shared/`)

PostgreSQL tracks task state, events, permissions, artifacts, and memory records. pgvector handles retrieval with namespace policies enforced by `utils/shared/permissions/`.

### API (`api/`)

DRF provides the HTTP surface. Views are thin: validate input, call app services, serialize output. See `docs/skills/django-backend/`.

### Shared Foundations (`utils/shared/`)

Cross-app utilities for auth, permissions, storage, search, embeddings, and events.

### Frontend (`web/`)

React/Vite SPA consuming DRF APIs. No business logic beyond API client calls. App UI fragments may live in `utils/apps/{app}/frontend/`.

## Schemas And Structured Outputs

Specialists and app tools return structured results, not loose chat text:

```json
{
  "agent_id": "repo_inspector",
  "status": "success",
  "summary": "The repo is a Python package with a CLI entrypoint.",
  "findings": [],
  "artifacts": [],
  "recommended_next_agent": "code_editor"
}
```

Structured results let the coordinator validate, summarize, retry, or route to the next specialist.

## Skills

Skills remain useful as lightweight instruction packs in `docs/skills/`. They are not the main architecture.

```text
Skills = static instructions (docs/skills/)
Workflows = executable LangGraph graphs (agents/)
Tools = capabilities (agents/tools/ + utils/apps/{app}/agent/)
Datasets = knowledge sources
Policies = access control (utils/shared/permissions/)
```

## Migration Note

The previous `src/agent_runtime/` layout is retired. See `docs/skills/repo-structure/SKILL.md` for the concept mapping and `docs/rebuild-plan.md` for the full rebuild reference.
