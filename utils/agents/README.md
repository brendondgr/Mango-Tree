# Agents

LangGraph orchestration layer for the Mango platform.

## Subdirectories

| Directory | Role |
| --- | --- |
| `coordinator/` | Request classification, routing, task packages, result validation, events |
| `planner/` | Broad reasoning, inspection, planning, delegation |
| `memory/` | Short-term memory, vector memory, namespaces |
| `tools/` | Tool registry, execution context, permission enforcement |
| `providers/` | Local (Llama-CPP) and cloud model provider abstraction |

App-specific specialist workflows live under `utils/apps/{app}/agent/`.

See `docs/skills/repo-structure/structures/langgraph.md`.
