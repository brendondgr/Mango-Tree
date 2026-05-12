# Goals

The goal is to build a local personal agent runtime with strong boundaries. It should support local LLMs with tool calling through a custom inference adapter, route tasks through an orchestrator, and use specialist LangGraph workflows when work needs a contained environment or concise toolset.

This is not meant to be one giant agent with a large pool of skills and tools. The system should be modular, inspectable, and permissioned.

## Product Goals

- Build a local-first agent runtime that can inspect repositories, plan changes, edit code, run tests, index knowledge, and produce structured reports.
- Support custom local model inference without requiring an OpenAI-compatible API.
- Use an orchestrator to classify requests, choose workflows, create scoped task packages, and validate results.
- Keep a general agent available for broad reasoning, lightweight repo inspection, planning, and delegation.
- Use specialist LangGraph workflows for narrow tasks that need constrained tools, memory, datasets, filesystem paths, or shell access.
- Make every meaningful action traceable through task events, artifacts, logs, and structured outputs.
- Preserve extensibility through registries, manifests, capability bundles, and workflow configuration.

## Architecture Goals

The core system shape should be:

```text
User
  |
  v
Orchestrator
  |
  +--> General Agent
  |
  +--> repo_inspector subgraph
  |
  +--> code_editor subgraph
  |
  +--> test_runner subgraph
  |
  +--> latex_builder subgraph
  |
  +--> rag_indexer subgraph
  |
  +--> model_evaluator subgraph
```

The orchestrator should route, not execute arbitrary work. The general agent should inspect, reason, and delegate. Specialists should execute narrow workflows with explicit boundaries.

Specialists should be LangGraph subgraphs or workflow nodes rather than plain prompt-only skills. Skills still have a role, but as static instruction packs that can be loaded inside workflows.

```text
Skills = static instructions
Workflows = executable graphs
Tools = executable capabilities
Datasets = knowledge sources
Policies = access control
```

## Isolation Goals

The runtime should minimize what each agent can see and do.

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

The system should use relational storage for runtime state and a vector store for retrieval.

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

## Workflow Goals

Specialists should return structured results so the orchestrator can validate and route follow-up work.

Example `repo_inspector` result:

```json
{
  "agent_id": "repo_inspector",
  "status": "success",
  "summary": "The repo is a CLI-driven Python package.",
  "findings": [
    {
      "type": "entrypoint",
      "path": "src/agent_runtime/cli.py",
      "evidence": "Defines command-line commands."
    }
  ],
  "artifacts": [],
  "recommended_next_agent": "code_editor"
}
```

Example workflow flow:

```text
START
  -> ingest_request
  -> load_runtime_context
  -> route_request
  -> selected agent or specialist subgraph
  -> validate_result
  -> maybe_followup_or_finish
  -> END
```

## Milestones

### Phase 1: Inference Wrapper And Tool Registry

Build the local inference adapter, prompt rendering, tool-call parsing, structured-output validation, tool registry, `ExecutionContext`, and permission checks.

The milestone is complete when a read-only general agent can call safe tools through the registry and all tool calls are policy checked.

### Phase 2: Orchestrator And General Agent

Build the parent graph, deterministic router, LLM router fallback, task database, event logging, and general agent graph.

The milestone is complete when a user request can route to the general agent and produce a final answer with recorded task events.

### Phase 3: First Specialist: `repo_inspector`

Build the first specialist workflow with only `list_dir`, `read_file`, and `search_files`.

The milestone is complete when the orchestrator can route a repo inspection request to the specialist and receive a structured report.

### Phase 4: Controlled Code Editor

Add a code editing specialist with scoped read and write paths, patch application, and diff reporting. Avoid raw shell access in this phase.

The milestone is complete when the specialist can apply controlled patches and return a changed-file summary without writing outside its allowed workspace.

### Phase 5: Sandboxed Test Runner

Add a test runner specialist that executes approved commands in a sandbox, captures logs, parses failures, and returns a structured test report.

The milestone is complete when code changes can be validated by the test runner without giving agents unrestricted shell access.

### Phase 6: Memory, Indexing, And Dataset Permissions

Add repo indexing, vector namespaces, memory permissions, dataset manifests, and dataset access policies.

The milestone is complete when specialists retrieve only authorized context and denial cases are covered by tests.

## Success Criteria

- The runtime can answer, inspect, edit, test, and index through explicit workflows.
- Local inference can be swapped without rewriting agents.
- New specialists can be added through manifests, graph builders, schemas, and capability bundles.
- Every tool call is permission checked.
- Every specialist has a narrow contract.
- Every important action leaves an event or artifact trail.
- Security boundaries are enforced in code, not delegated to model behavior.
