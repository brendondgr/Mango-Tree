# Events

`trace.py` — `emit_trace_event(...)` appends one JSON line per **artifact**
operation to `{artifacts_root}/events.jsonl`.

That is the full scope. It is not a general task or agent-action event system.
Agent turn progress (`node_start`, `tool_call`, `tool_result`, `final_answer`)
is streamed to the client as SSE from `utils/agents/coordinator/graph.py` and is
never written here or anywhere else.
