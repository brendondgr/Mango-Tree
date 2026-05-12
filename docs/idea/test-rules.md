# Test Rules

Testing for this project should prove that the runtime is constrained, inspectable, and predictable. The most important test theme is not whether an agent "usually behaves"; it is whether the system enforces routing, permissions, schemas, and workspace boundaries even when a model asks for the wrong thing.

Agents must not self-enforce security. Every executable tool must enforce its `ExecutionContext`.

## Testing Philosophy

The test suite should focus on four guarantees:

1. Requests are routed to the right agent or specialist workflow.
2. Specialists only receive the state, tools, memory, datasets, and paths they are allowed to use.
3. Tool calls are validated and rejected before side effects happen.
4. Workflows return structured outputs that the orchestrator can validate and record.

Mock local inference wherever possible. Tests should validate the runtime contract around model output, not depend on a particular model behaving well.

## Test Layout

Tests should be compartmentalized by concern and by agent or workflow. The goal is to keep each directory small enough that it can hold a focused cluster of tests, usually only a handful, rather than a single flat directory that grows without structure.

Recommended shape:

```text
tests/
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

Each subdirectory should stay narrow in purpose. For example, `tests/agents/repo_inspector/` should contain only the tests for that specialist's contract, tool access, and output shape. When a concern grows beyond a few focused cases, split it into another subdirectory instead of piling everything into one folder.

## Core Acceptance Rules

- A model response is never permission by itself.
- A tool must reject calls from agents that do not have the tool in `allowed_tools`.
- Filesystem tools must check `allowed_read_paths`, `allowed_write_paths`, and `allowed_execute_paths`.
- Memory and vector retrieval must check allowed namespaces before search.
- Dataset access must check dataset manifests and per-agent access files.
- Shell execution must go through a command policy and, for risky commands, a sandbox.
- Specialist workflows must validate input and output schemas.
- The orchestrator must record task events for routing, tool calls, specialist results, failures, retries, and final answers.
- Tests should include denial cases, not only successful flows.

## Execution Context Contract

Every tool should receive an execution context similar to this:

```python
@dataclass
class ExecutionContext:
    task_id: str
    agent_id: str
    allowed_tools: set[str]
    allowed_read_paths: list[str]
    allowed_write_paths: list[str]
    allowed_execute_paths: list[str]
    allowed_memory_namespaces: list[str]
    allowed_datasets: list[str]
    shell_policy: ShellPolicy
```

A filesystem tool should enforce the context before reading or writing:

```python
def read_file(ctx: ExecutionContext, path: str) -> str:
    policy.check_tool_allowed(ctx, "read_file")
    policy.check_read_path(ctx, path)
    return Path(path).read_text()
```

The model can ask for `read_file`. The policy decides whether that call is legal.

## Routing Tests

Deterministic routing tests should cover obvious requests before any LLM router is used.

- A request containing test language routes to `test_runner`.
- A request asking to inspect a repository routes to `repo_inspector`.
- A request about editing files routes to `code_editor`.
- A request about LaTeX or PDF compilation routes to `latex_builder`.
- A request about indexing documents or code routes to `rag_indexer`.

LLM router tests should use mocked model outputs and validate schema handling.

```json
{
  "route": "repo_inspector",
  "confidence": 0.86,
  "reason": "The request asks for repository structure.",
  "required_permissions": ["filesystem.read"],
  "required_inputs": ["repo_path", "question"]
}
```

Test cases should include:

- valid route object accepted,
- unknown route rejected,
- missing required fields rejected,
- malformed JSON rejected,
- low confidence routed to general agent or clarification path,
- required permissions checked against the selected workflow manifest.

## Tool Registry Tests

The tool registry is a security boundary. Tests should verify:

- all registered tools have descriptions, input schemas, output schemas where needed, and permission metadata,
- agents only receive tools from their declared capability bundles,
- unavailable tools cannot be called by name,
- tool input is validated before execution,
- tool output is normalized before returning to the graph,
- disabled tools are not exposed through bundles,
- tool bundle changes are reflected in agent manifests.

Example capability bundle under test:

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

The `repo_inspector` should pass with this bundle. The same test should fail if it attempts `apply_patch` or `run_command`.

## Filesystem And Sandbox Tests

Filesystem tests should cover path traversal, symlinks, absolute paths, and workspace boundaries.

- `read_file` succeeds inside an allowed read path.
- `read_file` rejects paths outside allowed read paths.
- `write_file` rejects reads-only workspaces.
- `apply_patch` only writes inside allowed write paths.
- shell execution rejects commands outside allowed execute paths.
- denied files such as `.env`, `secrets/`, and `private/` remain denied even if they are inside an allowed parent path.
- symlinks cannot escape the allowed workspace.

Sandboxed command tests should cover:

- command allowlist and denylist behavior,
- timeout handling,
- log capture,
- exit code capture,
- network policy behavior,
- mounted path restrictions,
- environment variable filtering.

The test runner specialist should be able to execute approved test commands in a sandbox and return a structured report. It should not be able to write arbitrary project files or read secrets.

## Memory And Dataset Tests

Memory tests should prove that retrieval is namespaced and policy-filtered.

```python
def retrieve(query, agent_id, namespace, top_k=8):
    allowed_namespaces = policy.allowed_memory_namespaces(agent_id)
    if namespace not in allowed_namespaces:
        raise PermissionError
    return vector_store.search(query=query, namespace=namespace, top_k=top_k)
```

Required cases:

- allowed namespace retrieval succeeds,
- disallowed namespace retrieval fails,
- agent-private memory is invisible to other agents,
- task-scoped memory is invisible outside that task unless explicitly promoted,
- vector metadata filters include the requesting agent or allowed group,
- dataset manifests grant only the declared read/write/execute access,
- raw datasets are not exposed to agents when only processed datasets are allowed.

## Specialist Workflow Tests

Each specialist should have tests for input validation, allowed tools, workflow steps, output schema, and failure reporting.

### `repo_inspector`

- receives only `repo_path`, `question`, allowed paths, and relevant policy data,
- uses read-only tools,
- reads expected key files when present,
- returns findings with paths and evidence,
- recommends a next agent only when useful,
- rejects attempts to write files or run commands.

### `code_editor`

- receives a scoped edit task and allowed write paths,
- inspects relevant files before proposing changes,
- applies patches only through approved tools,
- returns a diff summary and changed artifact list,
- rejects edits outside the task scope,
- can hand off to `test_runner` after changes.

### `test_runner`

- receives an approved command or chooses from a manifest allowlist,
- runs in a sandbox,
- captures logs and exit codes,
- parses failures into structured fields,
- stores logs as artifacts,
- rejects unsafe commands.

Example structured test result:

```json
{
  "agent_id": "test_runner",
  "status": "failed",
  "command": "pytest tests/",
  "exit_code": 1,
  "summary": "Three tests failed due to a missing environment variable.",
  "failures": [
    {
      "file": "tests/test_inference.py",
      "line": 42,
      "error": "MODEL_PATH not set"
    }
  ],
  "logs_path": "workspaces/tasks/task_001/logs/pytest.log"
}
```

## Event And Artifact Tests

The runtime should leave a durable trace of what happened.

Test that each task records:

- original user request,
- selected route,
- policy used for the task,
- specialist invocations,
- tool call summaries,
- errors and retries,
- produced artifacts,
- final answer.

Artifact tests should verify that reports, patches, logs, datasets, and generated files are stored under task-scoped output paths and linked to the task id and agent id.

## Documentation Acceptance Checks

For documentation-only updates in this folder:

- all target Markdown files must be non-empty,
- headings must match the intended purpose of the file,
- fenced code blocks must be closed,
- examples must not assume OpenAI-compatible inference,
- security guidance must consistently say tools and policies enforce access,
- test directory guidance must describe grouped subdirectories rather than a flat test pile,
- transcript content should be synthesized into docs instead of copied wholesale.
