---
applyTo: "agents/**/*.py,api/**/*.py,utils/**/*.py,config/**/*.py,tests/**/*.py"
---

# Python Backend Instructions

- Use `uv` for commands and dependencies.
- Keep agent orchestration in `agents/` separate from app domain logic in `utils/apps/`.
- Keep DRF views thin; domain logic belongs in `utils/apps/{name}/backend/services/`.
- Agent tools in `utils/apps/{name}/agent/tools.py` must call the same services as DRF views.
- Enforce permissions in code through `utils/shared/permissions/` and execution context.
- Validate structured model outputs before routing or recording them.
- Write tests for allowed and denied behavior.
- Mock local inference in tests unless the goal is model-runtime validation.
