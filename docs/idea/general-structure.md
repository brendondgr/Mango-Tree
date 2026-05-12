# General Structure

This project should be structured as a local agent runtime: a system that routes a user request through an orchestrator, delegates broad work to a general agent, and sends narrow tasks to specialist LangGraph workflows with scoped tools, memory, datasets, and permissions.

The architecture should avoid one large agent with every tool loaded at once. Instead, each agent or workflow should receive only the tools, state, paths, datasets, and memory namespaces needed for its task.

## Runtime Shape

```text
User
  |
  v
Orchestrator
  - classifies the request
  - selects the workflow or agent
  - builds a scoped task package
  - validates structured results
  |
  v
General Agent
  - handles broad reasoning
  - performs light repo/file inspection
  - creates plans
  - delegates specific work
  |
  v
Specialist LangGraph Workflows
  - repo inspection
  - code editing
  - test execution
  - documentation writing
  - LaTeX building
  - RAG indexing
  - local model evaluation
```

The orchestrator is the dispatcher, not the worker. The general agent is the flexible assistant, but it should not become an unrestricted executor. Specialist workflows are constrained workers with narrow input schemas, narrow output schemas, narrow tool bundles, narrow memory access, and narrow filesystem permissions.

## Proposed Repository Layout

```text
agent_runtime/
|-- pyproject.toml
|-- README.md
|-- .env.example
|-- configs/
|   |-- models.yaml
|   |-- agents.yaml
|   |-- tools.yaml
|   |-- permissions.yaml
|   `-- workflows.yaml
|-- src/
|   `-- agent_runtime/
|       |-- main.py
|       |-- cli.py
|       |-- inference/
|       |   |-- base.py
|       |   |-- local_client.py
|       |   |-- prompt_renderer.py
|       |   |-- tool_call_parser.py
|       |   `-- structured_output.py
|       |-- orchestration/
|       |   |-- graph.py
|       |   |-- router.py
|       |   |-- state.py
|       |   |-- policies.py
|       |   |-- checkpoints.py
|       |   `-- events.py
|       |-- agents/
|       |   |-- base.py
|       |   |-- orchestrator/
|       |   |-- general/
|       |   `-- specialists/
|       |       |-- repo_inspector/
|       |       |-- code_editor/
|       |       |-- test_runner/
|       |       |-- latex_builder/
|       |       |-- rag_indexer/
|       |       `-- model_evaluator/
|       |-- tools/
|       |   |-- registry.py
|       |   |-- base.py
|       |   |-- filesystem.py
|       |   |-- shell.py
|       |   |-- git.py
|       |   |-- search.py
|       |   |-- database.py
|       |   |-- vector_store.py
|       |   `-- model_runtime.py
|       |-- memory/
|       |   |-- short_term.py
|       |   |-- long_term.py
|       |   |-- vector_memory.py
|       |   |-- repo_index.py
|       |   `-- namespaces.py
|       |-- storage/
|       |   |-- db.py
|       |   |-- models.py
|       |   |-- migrations/
|       |   `-- repositories/
|       |-- sandbox/
|       |   |-- docker_runner.py
|       |   |-- command_policy.py
|       |   |-- mounts.py
|       |   `-- network_policy.py
|       |-- schemas/
|       |   |-- tool_call.py
|       |   |-- agent_message.py
|       |   |-- task.py
|       |   |-- permissions.py
|       |   `-- artifacts.py
|       `-- observability/
|           |-- trace.py
|           |-- logs.py
|           `-- evals.py
|-- workflows/
|   |-- repo_inspection.yaml
|   |-- code_editing.yaml
|   |-- latex_build.yaml
|   |-- test_execution.yaml
|   `-- model_eval.yaml
|-- skills/
|   `-- example_skill/
|       `-- SKILL.md
|-- data/
|   |-- runtime.db
|   |-- vector_store/
|   |-- repo_indexes/
|   |-- artifacts/
|   |-- logs/
|   `-- datasets/
|-- workspaces/
|   |-- repos/
|   |-- tasks/
|   `-- sandboxes/
`-- tests/
    |-- orchestration/
    |   |-- test_router.py
    |   |-- test_state.py
    |   `-- test_events.py
    |-- tools/
    |   |-- test_registry.py
    |   |-- test_permissions.py
    |   `-- test_filesystem.py
    |-- agents/
    |   |-- general/
    |   |-- repo_inspector/
    |   |-- code_editor/
    |   `-- test_runner/
    |-- workflows/
    |   |-- test_repo_inspection.py
    |   |-- test_code_editing.py
    |   `-- test_test_runner.py
    |-- memory/
    |   |-- test_namespaces.py
    |   `-- test_dataset_access.py
    `-- sandbox/
        |-- test_command_policy.py
        `-- test_mounts.py
```

## Subsystems

### Inference

The inference layer should hide the local model backend behind a small adapter. The rest of the runtime should not assume an OpenAI-compatible API.

```python
class BaseLLMClient:
    def complete(self, messages, *, temperature=0.0, max_tokens=None):
        raise NotImplementedError

    def complete_json(self, messages, schema):
        raise NotImplementedError

    def complete_with_tools(self, messages, tools):
        raise NotImplementedError
```

`LocalLLMClient` should render prompts, call the custom local backend, parse tool calls, and validate structured output. This keeps LangGraph nodes and agents independent from the specific inference server.

### Orchestration

The orchestration layer owns graph construction, task state, route selection, checkpoints, policy loading, and event recording.

Routing should happen in two stages:

1. Deterministic rules for obvious requests, such as tests, repo inspection, LaTeX, or model evaluation.
2. A small LLM router that returns a validated route object when rules are not enough.

```json
{
  "route": "repo_inspector",
  "confidence": 0.86,
  "reason": "The user is asking about repository structure.",
  "required_permissions": ["filesystem.read"],
  "required_inputs": ["repo_path", "question"]
}
```

Routes should come from workflow and agent registries, not hardcoded prompt text.

### Agents

The orchestrator, general agent, and specialists should have separate state schemas.

```python
class OrchestratorState(TypedDict):
    task_id: str
    user_request: str
    active_repo: str | None
    route: str | None
    policy: dict
    specialist_results: list[dict]
    final_answer: str | None
```

The parent graph should call specialist subgraphs through wrapper nodes that map parent state into the specialist input schema. A specialist should not receive the whole conversation or full global state unless that is explicitly required.

### Tools

Tools are executable capabilities. They should be registered with descriptions, schemas, permission requirements, and implementation references.

Tools should be grouped into capability bundles, such as:

```yaml
bundles:
  read_only_repo:
    tools:
      - list_dir
      - read_file
      - search_files
    permissions:
      - filesystem.read

  code_editing:
    tools:
      - read_file
      - apply_patch
      - git_diff
    permissions:
      - filesystem.read
      - filesystem.write_limited

  test_execution:
    tools:
      - run_command
      - read_logs
    permissions:
      - shell.run_safe
      - filesystem.read
```

The tool layer must enforce access. The model can request access, but it cannot be trusted to self-enforce path, dataset, memory, shell, or network restrictions.

### Memory And Datasets

Use relational storage for task state, events, permissions, artifacts, and memory records. Use a vector store for retrieval. Do not put all retrieval data in one global collection.

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

Datasets should be separated into raw, processed, manifests, and access policy files.

```text
data/datasets/
|-- raw/
|-- processed/
|-- manifests/
`-- access/
```

Every retrieval call should include a policy filter for the requesting agent and namespace.

### Storage

The runtime database should track at least:

```sql
agents(id, name, type, manifest_path, enabled)
tools(id, name, module_path, permission_level, input_schema_json, enabled)
agent_tools(agent_id, tool_id)
tasks(id, parent_task_id, user_request, assigned_agent_id, status)
task_events(id, task_id, agent_id, event_type, payload_json)
memory_items(id, namespace, owner_agent_id, content, metadata_json, visibility)
memory_permissions(memory_namespace, agent_id, access_level)
artifacts(id, task_id, agent_id, artifact_type, path, metadata_json)
permissions(id, agent_id, resource_type, resource_pattern, access_level, requires_approval)
```

The `agent_tools`, `memory_permissions`, and `permissions` tables are core isolation boundaries.

### Sandboxing

Specialists that execute commands should run in scoped workspaces and, when appropriate, containers.

```text
workspaces/
|-- repos/
|-- tasks/
|   `-- task_001/
|       |-- input/
|       |-- output/
|       |-- scratch/
|       `-- logs/
`-- sandboxes/
```

The specialist receives explicit allowed read, write, and execute paths. The tool implementation checks those paths before touching the filesystem or shell.

### Schemas And Structured Outputs

Specialists should return structured results, not loose chat text.

```json
{
  "agent_id": "repo_inspector",
  "status": "success",
  "summary": "The repo is a Python package with a CLI entrypoint.",
  "findings": [
    {
      "type": "entrypoint",
      "path": "src/agent_runtime/cli.py",
      "evidence": "Defines the command-line interface."
    }
  ],
  "artifacts": [],
  "recommended_next_agent": "code_editor"
}
```

Structured results let the orchestrator validate, summarize, retry, or route to the next specialist without parsing raw logs.

### Skills

Skills remain useful, but they should be lightweight instruction packs used inside workflows. They are not the main architecture.

```text
Skills = static instructions
Workflows = executable LangGraph graphs
Tools = capabilities
Datasets = knowledge sources
Policies = access control
```

For example, a `latex_builder` workflow can load LaTeX debugging and academic writing skills, but the workflow still owns the actual graph steps, tool bundle, state schema, and output schema.
