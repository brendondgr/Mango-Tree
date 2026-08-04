# Coordinator

The agent loop. `graph.py` builds a four-node LangGraph state machine — the only
LangGraph graph in the repository — and `utils/api/routes/agent.py` invokes it
for every chat turn.

```text
reason ──(tool calls?)──> act ──> observe ──(under step limit?)──> reason
   │                                              │
   └──────────────(no tool calls)─────────────────┴──> respond
```

| Node | Does |
| --- | --- |
| `reason` | Builds the system prompt, message history, and prior observations; streams a chat completion; collects any `tool_calls` into `pending_actions` |
| `act` | Emits an SSE `tool_call` event per pending action (no dispatch) |
| `observe` | De-duplicates repeat calls, then dispatches through `registry.execute(...)` with the session's enabled tool groups |
| `respond` | Emits the final answer plus de-duplicated citations from `search_web` results |

`route_after_reason` sends the turn to `act` when tool calls are pending and to
`respond` otherwise. `route_after_observe` loops back to `reason` until
`max_steps` (default 6) or an error. Progress is streamed to the client as SSE
callbacks (`node_start`, `tool_call`, `tool_result`, `final_answer`, `error`);
none of it is persisted.

`state.py` defines the graph state dict.

## Not implemented

There is no intent classifier, no route or workflow selection, no scoped task
package, and no structured-result validation step. The conditional edges above
are the entirety of the routing. What a turn may touch is constrained by the
tool-group gate in `utils/agents/tools/`, not here.
