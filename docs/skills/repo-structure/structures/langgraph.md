# LangGraph Runtime Structure

Use LangGraph for explicit workflow state machines, not as a place to hide unrestricted agent behavior.

## Recommended Package Shape

```text
src/agent_runtime/
|-- orchestration/
|   |-- graph.py
|   |-- router.py
|   |-- state.py
|   |-- policies.py
|   |-- checkpoints.py
|   `-- events.py
|-- agents/
|   |-- orchestrator/
|   |-- general/
|   `-- specialists/
|       |-- repo_inspector/
|       |-- code_editor/
|       |-- test_runner/
|       |-- latex_builder/
|       |-- rag_indexer/
|       `-- model_evaluator/
|-- tools/
|-- schemas/
`-- observability/
```

## Rules

- Parent graphs map global task state into a specialist input schema.
- Specialist subgraphs return structured results that the orchestrator validates.
- Nodes should perform one clear responsibility, such as route selection, context loading, tool execution, or result validation.
- Tool calls must go through the registry and execution context.
- Do not pass full conversation history, all tools, all memory, or unrestricted shell access into a specialist by default.
