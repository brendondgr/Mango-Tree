# Mango Tree Documentation

Mango Tree is a local-first personal agent runtime with strong boundaries. It routes user requests through an orchestrator, delegates broad reasoning to a general agent, and executes narrow work through specialist LangGraph workflows.

## Stack

- Python managed with `uv`.
- LangGraph for orchestrator and specialist workflow graphs.
- Custom local model inference adapter, not tied to an OpenAI-compatible server.
- Relational storage for tasks, events, memory records, artifacts, permissions, and runtime state.
- Vector storage for namespaced retrieval.
- Astro frontend under `web/` with Svelte, React, UnoCSS, and npm.

## Core Concepts

- Skills are static instruction packs.
- Workflows are executable graphs.
- Tools are executable capabilities.
- Datasets are knowledge sources.
- Policies are access control.

The model can request tool calls, but the runtime decides whether the call is legal.

## Skill Source Layout

The canonical skill documents now live under `docs/skills/`. The agent-specific directories in `.claude/skills/` and `.agents/skills/` point back to those central documents instead of duplicating content.
