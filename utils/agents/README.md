# Agents

The agent orchestration layer.

| Directory | State | Role |
| --- | --- | --- |
| `coordinator/` | implemented | The reason/act/observe/respond LangGraph loop — the whole agent runtime |
| `tools/` | implemented | Tool registry, `config/tools.yaml` loading, tool-group gate |
| `providers/` | implemented | One streaming client for OpenAI-compatible chat completions |
| `schemas/` | implemented | `ToolCall`, `ToolResult`, `AgentMessage` pydantic models |
| `skills/` | implemented | Static instruction packs the `inspect_skills` / `read_skill` tools read |
| `planner/` | **empty placeholder** | Nothing implemented; nothing imports it |
| `memory/` | **empty placeholder** | Nothing implemented; nothing imports it |

LangGraph is used in exactly one place: `coordinator/graph.py`. There are no
specialist graphs. `utils/apps/{app}/agent/` holds plain tool functions and
prompt strings, not workflows.

Entry point: `utils/api/routes/agent.py` streams
`POST /api/agent/<session_id>/agent_turn/` through `coordinator.graph.agent_graph`.
