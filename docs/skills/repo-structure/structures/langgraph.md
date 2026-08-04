# LangGraph Runtime Structure

Use LangGraph for explicit workflow state machines under `utils/agents/`, not as a place to hide unrestricted agent behavior.

> **Status: target shape, not current state.** Today there is exactly one graph —
> `utils/agents/coordinator/graph.py`, a `reason → act → observe → respond` loop.
> `utils/agents/planner/` and `utils/agents/memory/` are empty placeholders, and
> no specialist subgraphs exist: `utils/apps/{app}/agent/` holds plain tool
> functions and prompt strings. The shape below is where the layer is headed;
> do not write documentation or code that assumes any of it already runs.

## Recommended Package Shape

```text
utils/agents/
|-- coordinator/
|   |-- graph.py
|   |-- router.py
|   |-- state.py
|   |-- policies.py
|   |-- checkpoints.py
|   `-- events.py
|-- planner/
|   |-- graph.py
|   |-- state.py
|   `-- prompts.py
|-- memory/
|   |-- short_term.py
|   |-- vector_memory.py
|   `-- namespaces.py
|-- tools/
|   |-- registry.py
|   |-- base.py
|   `-- execution_context.py
|-- providers/
|   |-- base.py
|   |-- local_client.py
|   `-- cloud_client.py
`-- schemas/
    |-- task.py
    |-- tool_call.py
    |-- agent_message.py
    `-- artifacts.py
```

App-specific specialist workflows live under `utils/apps/{app_name}/agent/`:

```text
utils/apps/{app_name}/agent/
|-- tools.py
|-- prompts.py
`-- workflows/
    `-- specialist_graph.py
```

## Rules

- The coordinator graph maps global task state into specialist or app-tool input schemas.
- Specialist subgraphs return structured results that the coordinator validates.
- Nodes should perform one clear responsibility: route selection, context loading, tool execution, or result validation.
- Tool calls must go through the registry in `utils/agents/tools/` and execution context.
- App agent tools in `utils/apps/{app}/agent/tools.py` delegate to app services; do not duplicate business logic.
- Do not pass full conversation history, all tools, all memory, or unrestricted shell access into a specialist by default.

## Data Flow

```text
User request
  -> utils/agents/coordinator (route decision)
  -> utils/agents/planner (broad reasoning) OR app specialist workflow
  -> utils/agents/tools (registry + execution context)
  -> utils/apps/{app}/backend/services (domain logic)
  -> Event, artifact, and result records
  -> Structured response
```

Both the UI and agents reach domain logic through the same service layer. The UI goes through `api/`; agents go through registered tools.
