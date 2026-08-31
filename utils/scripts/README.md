# Scripts

Utility scripts for development, migration, and maintenance tasks.

## Runtime state

`init_data.py` creates what a clean clone does not have: the gitignored `data/`
directories, and the empty schemas for the three apps bound `managed = False` to
databases a previous app created. It builds those with Django's schema editor
rather than a migration, because a migration against those apps' real data would
corrupt it — and it skips any database that already exists, so it is safe to
re-run on a live install.

```bash
uv run utils/scripts/init_data.py --verbose
```

`./scripts/bootstrap` calls it; you rarely need to run it directly.

## Skill links

- `link-skills.ps1` — recreate `.cursor/`, `.claude/`, and `.codex/` skill directory links on Windows
- `link-skills.sh` — same for macOS and Linux

## UI audit harness

Two scripts that measure the **rendered** workspace rather than reasoning about
the source. Both sign in first, because everything except `/login` and `/signup`
is behind a session cookie and a plain crawler only ever sees the login page.

| Script | What it measures |
| --- | --- |
| `audit_ui.py` | axe-core violations, horizontal overflow, touch-target sizes, sub-16px inputs, and tab-order shape across 9 surfaces × N viewports. Writes JSON plus a screenshot per surface/viewport. |
| `verify_mobile.py` | Whether the app is *usable* on a phone: hit-tests what a finger actually lands on, taps for real, types into the composer, and checks the send control is on-screen. |

The split matters. `audit_ui.py` answers "does it render correctly"; a
`position: fixed` overlay can pass every visual check while intercepting every
tap underneath it, so `verify_mobile.py` answers "does a tap reach anything".

### Setup

```bash
uv sync --extra audit
```

```bash
uv run playwright install chromium
```

```bash
cd web && npm install
```

`axe-core` comes from `web/node_modules`; without it `audit_ui.py` still runs
the layout probes and says it skipped the accessibility scan.

### Running

Start the app (`python run.py`), then point the scripts at it. Credentials come
from the environment — they are never stored in the repo.

```bash
MANGO_AUDIT_USER=you MANGO_AUDIT_PASSWORD=yourpassword uv run utils/scripts/audit_ui.py --out .audit/baseline
```

```bash
MANGO_AUDIT_USER=you MANGO_AUDIT_PASSWORD=yourpassword uv run utils/scripts/verify_mobile.py
```

| Variable | Default |
| --- | --- |
| `MANGO_AUDIT_BASE` | `http://localhost:5173` |
| `MANGO_AUDIT_USER` | — required when the owner account exists |
| `MANGO_AUDIT_PASSWORD` | — required |

Useful flags: `--viewports 320x568,390x844,1280x800`, `--surfaces mailbox,recipes`,
`--no-axe`, `--no-shots`. `verify_mobile.py` takes `--width/--height/--shots`.

Both exit non-zero on failure, so either can gate a deploy. `audit_ui.py` fails
on page-level horizontal scroll or a critical axe violation; `verify_mobile.py`
fails when any tap is intercepted or the composer cannot be used.

Write output under `.audit/`, which is gitignored — commit findings, not runs.
