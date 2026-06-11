# Goals

The goal is to build a local personal agent platform with strong boundaries. It should support local LLMs with tool calling through a provider abstraction, route tasks through a coordinator, and use specialist LangGraph workflows and app-scoped tools when work needs a contained environment or concise toolset.

This is not meant to be one giant agent with a large pool of skills and tools. The system should be modular, inspectable, and permissioned.

## Product Goals

- Build a local-first agent platform that can inspect repositories, plan changes, edit code, run tests, index knowledge, and produce structured reports.
- Support custom local model inference without requiring an OpenAI-compatible API.
- Use a coordinator to classify requests, choose workflows, create scoped task packages, and validate results.
- Keep a planner available for broad reasoning, lightweight inspection, planning, and delegation.
- Use specialist LangGraph workflows and app tools for narrow tasks that need constrained tools, memory, datasets, filesystem paths, or shell access.
- Organize domain functionality as modular apps under `utils/apps/{app_name}/`.
- Expose all app capabilities through DRF APIs (for the UI) and registered agent tools (for the agent layer).
- Make every meaningful action traceable through task events, artifacts, logs, and structured outputs.
- Preserve extensibility through registries, manifests, capability bundles, and workflow configuration.

## Architecture Goals

The core system shape should be:

```text
User
  |
  v
web/ (React SPA)  -->  api/ (DRF)  -->  utils/apps/{app}/backend/services/
  |
  v
agents/coordinator
  |
  +--> agents/planner
  |
  +--> utils/apps/{app}/agent/tools --> utils/apps/{app}/backend/services/
```

The coordinator should route, not execute arbitrary work. The planner should inspect, reason, and delegate. App specialists should execute narrow workflows with explicit boundaries.

Skills still have a role as static instruction packs in `docs/skills/` that can be loaded inside workflows.

```text
Skills = static instructions (docs/skills/)
Workflows = executable LangGraph graphs (agents/)
Tools = executable capabilities (agents/tools/ + utils/apps/{app}/agent/)
Datasets = knowledge sources
Policies = access control (utils/shared/permissions/)
```

## Isolation Goals

The platform should minimize what each agent can see and do.

- No global tool pool for every agent.
- No arbitrary access to every memory collection.
- No arbitrary access to every dataset.
- No raw shell access by default.
- No filesystem access outside allowed paths.
- No reliance on prompts for security.

Every agent or specialist should receive a scoped task package:

```json
{
  "task_id": "task_001",
  "agent_id": "repo_inspector",
  "allowed_tools": ["list_dir", "read_file", "search_files"],
  "allowed_read_paths": ["workspaces/repos/example"],
  "allowed_write_paths": [],
  "allowed_memory_namespaces": ["repo_example"],
  "allowed_datasets": ["repo_example_index"]
}
```

The tool layer enforces these boundaries. The model only requests actions.

## Data And Memory Goals

The system should use PostgreSQL for runtime state and pgvector for retrieval.

Relational data should track:

- agents,
- tools,
- agent-to-tool permissions,
- tasks,
- task events,
- memory items,
- memory permissions,
- artifacts,
- resource permissions.

Vector data should be namespaced:

```text
vectors/
|-- global_docs
|-- repo_{repo_id}
|-- agent_{agent_id}_private
|-- specialist_repo_inspector
|-- specialist_latex_builder
|-- user_long_term_memory
`-- task_{task_id}
```

Datasets should be separated into raw, processed, manifests, and access policy files. Agents should generally consume processed, agent-visible datasets rather than raw source dumps unless a workflow explicitly requires raw data.

## API And Agent Parity Goals

- Every capability exposed to the UI via DRF must be reachable by agents through registered tools.
- App services in `utils/apps/{app}/backend/services/` are the single source of domain truth.
- The frontend (`web/`) contains no business logic beyond API client calls.

## Milestones

Follow the build sequence in `docs/rebuild-plan.md`:

1. Create the new `web/` React/Vite application shell.
2. Define app boundaries under `utils/apps/{app_name}`.
3. Build the shared API and tool interfaces.
4. Migrate one app at a time.
5. Connect the agent layer to the same app tools used by the UI.
6. Delete old frontend artifacts after replacement is complete.

## Success Criteria

- The platform can answer, inspect, edit, test, and index through explicit workflows and app tools.
- Local inference can be swapped without rewriting agents.
- New apps and specialists can be added through manifests, graph builders, schemas, and capability bundles.
- Every tool call is permission checked.
- Every specialist has a narrow contract.
- Every important action leaves an event or artifact trail.
- Security boundaries are enforced in code, not delegated to model behavior.
- The UI and agents share the same service layer.
