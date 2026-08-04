# App Migration Setup

This skill provides the authoritative procedure for folding a legacy application into a
Mango Tree app module under `utils/apps/{name}/`.

## Canonical source

Edit `docs/skills/app-migration/SKILL.md` and its reference files only. The
`.cursor/`, `.claude/`, and `.codex/` paths are links, not copies.

## Files

```text
docs/skills/app-migration/
|-- SKILL.md                     # the 10-stage pipeline (read first)
|-- SETUP.md                     # this file
|-- database-preservation.md     # keep-the-data-the-same strategies (A/B/C)
|-- templates.md                 # Diagnosis Report, Migration Plan, checklist
`-- frameworks/
    |-- django.md
    |-- flask.md
    |-- fastapi.md
    `-- express.md
```

## Skill discovery

Already wired. `app-migration` is in the `skills` array of both
`utils/scripts/link-skills.sh` and `utils/scripts/link-skills.ps1`, and resolves
under `.cursor/skills/`, `.claude/skills/`, and `.codex/skills/`.

Re-run `./utils/scripts/link-skills.sh` (or `.ps1` on Windows) only if the links
appear as plain text files after a clone.

## Relationship to existing skills

- Extends the brief Flask-only checklist in `docs/skills/app-modules/SKILL.md` into a
  full, framework-agnostic procedure. Keep `app-modules` as the layout authority; this
  skill is the migration procedure.
- Produces plans in the shape required by `docs/skills/plan/SKILL.md`.
- Obeys the step-and-commit workflow in `docs/skills/global/SKILL.md`.
- Targets the backend conventions in `docs/skills/django-backend/SKILL.md` and the
  frontend conventions in `docs/skills/website-architecture/SKILL.md`.

## Validation commands

```bash
uv run manage.py check
uv run manage.py test
uv run pytest
cd web && npm run build
```

## Reference implementation

When in doubt about a target shape, read `utils/apps/media_viewer/` — the first fully
implemented app — especially `agent/tools.py` (ToolResult pattern, service injection),
`backend/services/`, `config/tools.yaml`, and `config/permissions.yaml`.
