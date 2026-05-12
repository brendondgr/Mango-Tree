# Plan Setup

This planning skill is configured for agentic coding workflows in the Mango Tree repository.

## Defaults

- Granularity: detailed engineering plans for phased implementation.
- Validation: targeted tests first, then broader test/build checks when the touched area justifies it.
- Git workflow: no automatic commit or push instructions.
- Audience: coding agents and engineers maintaining a local-first, permissioned agent runtime.

## Repository-Specific Focus

Plans should protect these core ideas:

- Orchestrator routes and validates.
- General agent reasons and delegates.
- Specialist LangGraph workflows execute narrow tasks.
- Tools enforce permissions through execution context.
- Memory, datasets, filesystem, shell, and network access are scoped by policy.
- Web UI work stays under `web/` and follows the documented architecture.
