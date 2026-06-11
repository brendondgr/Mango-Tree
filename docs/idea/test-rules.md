# Test Rules

Testing for this project should prove that the platform is constrained, inspectable, and predictable. The most important test theme is not whether an agent "usually behaves"; it is whether the system enforces routing, permissions, schemas, and workspace boundaries even when a model asks for the wrong thing.

Agents must not self-enforce security. Every executable tool must enforce its `ExecutionContext`.

## Testing Philosophy

The test suite should focus on four guarantees:

1. Requests are routed to the right agent or app specialist workflow.
2. Specialists only receive the state, tools, memory, datasets, and paths they are allowed to use.
3. Tool calls are validated and rejected before side effects happen.
4. Workflows return structured outputs that the coordinator can validate and record.

Mock local inference wherever possible. Tests should validate the runtime contract around model output, not depend on a particular model behaving well.

## Test Layout

Tests should be compartmentalized by layer and concern:

```text
tests/
|-- agents/
|   |-- coordinator/
|   |-- planner/
|   |-- memory/
|   `-- tools/
|-- api/
|   |-- routes/
|   `-- serializers/
|-- utils/
|   |-- apps/
|   |   |-- projects/
|   |   |-- notes/
|   |   `-- ...
|   `-- shared/
|       |-- auth/
|       |-- permissions/
|       `-- storage/
`-- web/
```

Each subdirectory should stay narrow in purpose. When a concern grows beyond a few focused cases, split it into another subdirectory.

## Core Acceptance Rules

- A model response is never permission by itself.
- A tool must reject calls from agents that do not have the tool in `allowed_tools`.
- Filesystem tools must check `allowed_read_paths`, `allowed_write_paths`, and `allowed_execute_paths`.
- Memory and vector retrieval must check allowed namespaces before search.
- Dataset access must check dataset manifests and per-agent access files.
- Shell execution must go through a command policy and, for risky commands, a sandbox.
- Specialist workflows must validate input and output schemas.
- The coordinator must record task events for routing, tool calls, specialist results, failures, retries, and final answers.
- DRF views must enforce the same permissions as agent tools for equivalent operations.
- App agent tools must call the same services as DRF views; test both paths.
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

## API And Agent Parity Tests

When an app exposes a capability via DRF, verify:

- the DRF endpoint returns the expected structured response,
- the equivalent agent tool in `utils/apps/{app}/agent/tools.py` produces the same outcome via services,
- permission denial is consistent across both paths.

## Routing Tests

Deterministic routing tests should cover obvious requests before any LLM router is used.

- A request containing test language routes to the test runner specialist.
- A request asking to inspect a repository routes to the repo inspector.
- A request about editing files routes to the code editor.
- App-specific requests route to the appropriate `utils/apps/{app}/agent/` workflow.

LLM router tests should use mocked model outputs and validate schema handling.

## Tool Registry Tests

The tool registry in `agents/tools/` is a security boundary. Tests should verify:

- all registered tools have descriptions, input schemas, output schemas where needed, and permission metadata,
- agents only receive tools from their declared capability bundles,
- unavailable tools cannot be called by name,
- tool input is validated before execution,
- tool output is normalized before returning to the graph,
- disabled tools are not exposed through bundles.

## App Module Tests

Each app under `utils/apps/{name}/` should have tests for:

- service layer business logic,
- DRF view input/output validation,
- agent tool delegation to services,
- Celery task execution,
- permission denial cases.

## Documentation Acceptance Checks

For documentation-only updates:

- all target Markdown files must be non-empty,
- headings must match the intended purpose of the file,
- fenced code blocks must be closed,
- examples must not assume OpenAI-compatible inference,
- security guidance must consistently say tools and policies enforce access,
- test directory guidance must describe grouped subdirectories rather than a flat test pile.
