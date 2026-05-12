---
applyTo: "src/agent_runtime/**/*.py,tests/**/*.py,workflows/**/*.yaml,configs/**/*.yaml"
---

# Python Agent Runtime Instructions

- Use `uv` for commands and dependencies.
- Keep orchestration separate from tool execution.
- Enforce permissions in code through execution context.
- Validate structured model outputs before routing or recording them.
- Write tests for allowed and denied behavior.
- Mock local inference in tests unless the goal is model-runtime validation.
