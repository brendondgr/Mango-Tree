# Global Skill Setup

The global skill is always-on workflow guidance for every agent session in this repository.

## Discovery paths

Cursor, Claude Code, and Codex discover the skill from these project links:

- `.cursor/skills/global` → `docs/skills/global`
- `.claude/skills/global` → `docs/skills/global`
- `.codex/skills/global` → `docs/skills/global`

Cursor also applies the short always-on rule in `.cursor/rules/global.mdc`.

## After clone on Windows

Git may check out skill links as plain text files when `core.symlinks=false` (the Windows default). Run:

```powershell
./scripts/link-skills.ps1
```

On macOS or Linux:

```bash
./scripts/link-skills.sh
```

These scripts recreate directory links so agents can read each `SKILL.md`.

## Canonical source

Edit `docs/skills/global/SKILL.md` only. The `.cursor/`, `.claude/`, and `.codex/` paths are links, not copies.
