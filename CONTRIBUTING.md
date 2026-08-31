# Contributing

This is a personal platform, so the honest expectation first: it is built for one
owner's use, and a change that only makes sense for somebody else's setup will
probably be declined. Bug reports, a fix for something that is plainly broken,
and a new app module that follows the existing shape are all welcome.

## Get it running

```bash
git clone git@github.com:brendondgr/Mango-Tree.git && cd Mango-Tree && ./scripts/bootstrap
```

```bash
./scripts/server
```

```bash
./scripts/test
```

You need git, uv, Python 3.13 and Node before `bootstrap` will run. It is
idempotent, so re-run it after pulling.

On a fresh clone `./scripts/test` reports **570 passed, 62 skipped**. The skips
are `needs_legacy_data` — tests asserting against rows in the databases the
exercise, projectmanager and timekeeper apps were migrated from, which are not
in the repository. Nothing should ever fail; a failure is a real regression.

## How work is done here

The conventions live in `docs/skills/`, which is also what the coding agents in
this repo read. Start with
[`docs/skills/global/SKILL.md`](docs/skills/global/SKILL.md) — it defines the
step-and-commit workflow, and it is the one document to read before touching
anything.

| Doing | Read |
| --- | --- |
| Anything that edits files | `docs/skills/global/` |
| Backend, settings, migrations | `docs/skills/django-backend/` |
| A new or changed app module | `docs/skills/app-modules/` |
| Porting a standalone app in | `docs/skills/app-migration/` |
| Frontend architecture | `docs/skills/website-architecture/` |
| UI components and theming | `docs/skills/ui-frontend/` |
| Repository layout | `docs/skills/repo-structure/` |

`docs/skills/` is symlinked into `.claude/`, `.cursor/` and `.codex/`. Edit the
originals under `docs/`, never the links; if they arrive as plain text files on
Windows, run `./utils/scripts/link-skills.ps1`.

## Five rules that are not negotiable

1. **Business logic lives in `backend/services/`.** Views and agent tools are
   thin callers, and the agent must reach a capability through the same service
   the UI does.
2. **Never generate migrations for exercise, projectmanager or timekeeper.**
   Their models bind `managed = False` to databases a previous app created, and
   applying a migration would corrupt real data.
3. **An endpoint belongs in [`docs/api.md`](docs/api.md) before frontend code
   calls it.**
4. **Adding an agent tool is two edits** — the function in `agent/tools.py` and
   an entry in `config/tools.yaml`. Registration is config-driven.
5. **Commit messages carry no AI or tool attribution.** One logical change per
   commit, and the tests pass before it lands.

## Pull requests

Say what changed and how you checked it. A PR that touches the UI should say
which viewports you looked at; `utils/scripts/audit_ui.py` and
`utils/scripts/verify_mobile.py` are the instruments the project uses, and both
exit non-zero on a real regression.
