# Repository Structure

```text
.
|-- .agents/                  # Codex project skill links
|-- .claude/                  # Claude Code project skill links
|-- .cursor/                  # Cursor rules
|-- .github/                  # Copilot instructions
|-- docs/                     # Repository documentation
|-- docs/skills/              # Source skill documents
|-- web/                      # Astro frontend skeleton
|-- initialize.md             # Initial setup guide, preserved
|-- read-yaml.py              # Skill metadata scanner, preserved
|-- pyproject.toml            # Python project metadata
`-- uv.lock                   # Python lockfile
```

## Intended Runtime Structure

As implementation begins, add:

```text
configs/
src/agent_runtime/
workflows/
data/
workspaces/
tests/
```

Runtime code should stay under `src/agent_runtime/`, documentation under `docs/`, and frontend files under `web/`.
