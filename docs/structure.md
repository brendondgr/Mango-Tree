# Repository Structure

```text
.
|-- .claude/                  # Claude Code project skill links
|-- .codex/                   # Codex project skill links
|-- .cursor/                  # Cursor rules
|-- .github/                  # Copilot instructions
|-- agents/                   # LangGraph orchestration layer
|   |-- coordinator/
|   |-- planner/
|   |-- memory/
|   |-- tools/
|   `-- providers/
|-- api/                      # DRF route surface
|   |-- routes/
|   |-- serializers/
|   |-- middleware/
|   `-- schemas/
|-- config/                   # Django settings and runtime YAML
|-- docs/                     # Repository documentation
|   `-- skills/               # Source skill documents
|-- utils/
|   |-- apps/                 # Domain app modules
|   |   |-- projects/
|   |   |-- notes/
|   |   |-- jobs/
|   |   |-- calendar/
|   |   |-- recipes/
|   |   |-- imdbspy/
|   |   |-- exercise/
|   |   `-- timekeeper/
|   `-- shared/               # Cross-app foundations
|       |-- auth/
|       |-- permissions/
|       |-- storage/
|       |-- search/
|       |-- embeddings/
|       `-- events/
|-- tests/
|-- scripts/
|-- requirements/
|-- web/                      # React/Vite frontend (legacy Astro skeleton until rebuild)
|-- pyproject.toml            # Python project metadata
`-- uv.lock                   # Python lockfile
```

## Layer Rules

- Agent orchestration belongs in `agents/`.
- HTTP API surface belongs in `api/`.
- App domain code belongs in `utils/apps/{app_name}/`.
- Cross-app utilities belong in `utils/shared/`.
- Configuration belongs in `config/`.
- Documentation belongs in `docs/`.
- Frontend code belongs in `web/`.

See `docs/rebuild-plan.md` for the full rebuild reference.

## Migration Note

The previous `src/agent_runtime/` layout is retired. See `docs/skills/repo-structure/SKILL.md` for the concept mapping.
