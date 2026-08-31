# Repository audit — Mango Tree

**Date** 2026-08-31 · **Scope** [`repo-profile.yaml`](../repo-profile.yaml) ·
**Plan** [`docs/repo-restructure-plan.md`](repo-restructure-plan.md)

This audits the *repository* — structure, documentation truth, runnability from a
clean clone, and the GitHub front page. It is a different instrument from
[`docs/audit-report.md`](audit-report.md), which audited the rendered UI and is
finished. Nothing in this report has been applied.

---

## 1. The thirty-second verdict

A stranger who opens this repo reads a genuinely good README: a real one-liner, a
tool table whose numbers are correct to the last row, an architecture section
that names what is *not* built. That is rarer than it sounds and it is the
foundation everything below builds on.

Then they try it, and it does not work. Documented setup step 6 fails on every
clean clone, and `uv run pytest` — which the README presents without
qualification — reports **3 failed, 459 passed, 170 errors**. Both have the same
cause: `data/` is gitignored and nothing creates it, so the three apps bound to
pre-existing SQLite files have no files to bind to. One bootstrap step closes
both.

Three other things a reader hits before they get that far:

- **There is no LICENSE**, so the work is under exclusive copyright and legally
  nobody may use it.
- **The GitHub About line says "a fully autonomous agentic system."** The README
  four lines down says the opposite, correctly: every tool starts off, access is
  gated in code, the loop caps at six steps, and there is no planner. The
  sidebar is the first sentence anyone reads and it is the only inflated claim in
  the project.
- **A visual product with no visuals.** Eight app UIs, eight themes, an animated
  workspace — and the only committed asset is a logo SVG.

**28 findings: 4 blocker, 6 major, 9 minor, 9 advisory.**

---

## 2. Gates

### TRUTH — PASS, with one exception outside the README

Sampled every countable claim in `README.md` against the code:

| Claim | Where | Checked how | Result |
| --- | --- | --- | --- |
| 63 app tools, 6 core | README:33-36 | `yaml.safe_load(config/tools.yaml)`, grouped | **exact** |
| Per-app tool counts (10/12/15/7/6/5/4/4) | README:24-31 | same | **all eight exact** |
| Eight themes | README:283 | `git ls-files web/src/styles/themes` → 8 | **exact** |
| `planner/` and `memory/` are empty placeholders | README:61 | `git ls-files` → `__init__.py` + `README.md` only | **true** |
| No Postgres/Redis/Celery/S3 | README:80 | dependency scan of `pyproject.toml` | **true** |
| Secure-cookie trap | README:167-171 | matches `config/django/settings.py` and `.env.example` | **true** |
| Every documented file and command exists | whole file | `audit_docs.py --all` | **no stale paths** — the 27 reported path misses are all false positives (a sentence saying `agents.yaml` does *not* exist, build outputs under `dist/`, and the two historical audit documents) |

A README whose numbers all survive a recount is the strongest signal in this
audit. The exception is not in the README at all — it is the repository
description on GitHub, finding **B4**.

### RUNNABLE — FAIL

Clean `git clone` into `ghcr.io/astral-sh/uv:python3.13-bookworm`, documented
commands only, 2026-08-31:

| Step | README | Result |
| --- | --- | --- |
| `uv sync --extra dev` | :90 | OK, 11.7s |
| `cp .env.example .env` | :94 | OK |
| `uv run manage.py migrate` | :102 | OK, 15 migrations |
| `uv run manage.py migrate --database=imdbspy` | :106 | **FAIL** — `OperationalError: unable to open database file` |
| `uv run pytest` | :190 | **FAIL** — 3 failed, 459 passed, 170 errors, 41s |

`cd web && npm install` was not exercised — the image has no Node. That step is
untested here, not passed.

Every finding below §3 is provisional until this gate is green: polish on a repo
that does not run from a clean clone is decoration.

---

## 3. Blockers

### B1 · FUNCTIONAL — Documented setup fails on every clean clone

```
where:    README.md:106
claim:    uv run manage.py migrate --database=imdbspy
observed: django.db.utils.OperationalError: unable to open database file
cause:    config/django/settings.py:88 points imdbspy at
          data/imdbspy/imdbtracker.db. `data/` is gitignored (.gitignore:8) and
          nothing in the documented path creates it. SQLite will create a
          missing *file*, never a missing *directory*.
command:  docker run --rm -v <clean-clone>:/work -w /work \
            ghcr.io/astral-sh/uv:python3.13-bookworm \
            bash -lc 'uv sync --extra dev && cp .env.example .env &&
                      uv run manage.py migrate &&
                      uv run manage.py migrate --database=imdbspy'
fix:      Create data/{imdbspy,exercise,projectmanager,timekeeper,recipes}/ in a
          bootstrap step. See B2 — same root cause, same fix.
effort:   mechanical, ~30 min
```

### B2 · FUNCTIONAL — `uv run pytest` fails on every clean clone

```
where:    README.md:190, README.md:197-200
observed: 3 failed, 459 passed, 170 errors
          FileNotFoundError: '/work/data/timekeeper/timekeeper.db'
          (the fixture shutil.copy's a pre-existing DB into a temp path)
by app:   projectmanager 54 · timekeeper 59 · exercise 57 errors
          — exactly the three apps bound managed=False to files under data/
why:      README §Testing describes the suite as covering denial cases and says
          nothing about 170 of them being unable to start. A reader runs the
          documented command once, sees a wall of red, and concludes the project
          does not work. It does; the fixtures have no seed.
fix:      Seed empty schema files for the three unmanaged apps at bootstrap, or
          have the fixtures create the DB when the source file is absent.
          calendar and recipes already seed on first run — the pattern exists.
effort:   needs a decision from you: seed-on-bootstrap vs seed-in-fixture.
verify:   the container command in B1, plus `uv run pytest`
```

### B3 · LEGAL — No LICENSE

```
where:    repository root
observed: no LICENSE/LICENCE/COPYING in .github/, root or docs/.
          gh repo view → "licenseInfo": null.
          pyproject.toml has no `license` field either.
why:      Without a licence the work is under exclusive copyright. GitHub's terms
          grant viewing and forking and nothing else — nobody may copy, modify or
          run it. This is the one hygiene item that is never advisory, and it is
          load-bearing the moment the repo goes public.
fix:      MIT (your choice, 2026-08-31): LICENSE at root, plus
          license = "MIT" in pyproject.toml (PEP 639 SPDX string form).
effort:   mechanical, 5 min
```

### B4 · FUNCTIONAL — The GitHub description contradicts the repository

```
where:    GitHub About sidebar (not a file — Settings, or `gh repo edit -d`)
observed: "A fully autonomous agentic system regrown using the roots of my
          previous Mango Agent"
contradicted by:
          README.md:36  "All 63 app tools start off"
          README.md:38  "The gate runs twice — a disabled group's tools are never
                         offered to the model, and are refused at execution"
          README.md:59  "up to six steps per turn"
          README.md:61  "There is no separate planner"
why:      The About line is the first sentence a visitor reads and the text that
          renders in every shared link and search result. "Fully autonomous" is
          the single claim in this project that the code does not back — and the
          project's actual design decision, gating access in code rather than
          asking for it in a prompt, is more interesting than the inflated
          version. This is the one place the repo currently oversells itself.
fix:      Replace with the profile one-liner. Needs your wording; a starting
          point is in the plan, Stage 6.
effort:   2 min, manual (GitHub UI or `gh repo edit`)
```

---

## 4. Major

### M1 · PRACTITIONER-CONSENSUS — Seven steps to first run, no entrypoint

`README.md:84-107` is seven separate fenced commands, and `run.py` is an eighth.
The measured target is one command for setup, one to run, one to test; five or
more is a finding. *"If you have to do 10 steps to run this project, then you
know something is wrong"* (Husain); Joel Test item 2 makes the same point from
2000. A stranger tries once.

The fix is one entrypoint per verb — `make setup` / `script/bootstrap` / `just
setup`; which tool is your call. It also has to create the `data/` tree, which
makes it the same fix as B1 and B2.

### M2 · PRACTITIONER-CONSENSUS — A visual product with no visual proof

`audit_assets.py`: one committed asset, `docs/assets/mango-color.svg` (212 KB,
an Inkscape trace of a webp). For a `web-app` archetype the hero asset is the
highest-value item on the page — the reader wants to see it before reading about
it, and a web app with no visual is one the reader assumes does not work.

Two specifics: GitHub's own documentation states SVGs may fail to render in
Firefox, so **an SVG must never be the only hero**; and there is no live demo
here by design (single-owner, self-hosted), which means committed screenshots
are not the fallback — they are the whole showcase.

### M3 · SURVEY-DATA — The README never says why this exists

`audit_readme.py`: sections classify as what / how / reference / when /
contribution. No **Why**. Purpose appears in 25.7% of READMEs (Prana et al.,
393 hand-annotated) and it is the section this specific reader — a hiring
manager, after the resume passed — most needs, because it is what separates
"built deliberately, with judgement" from "completed a project."

Honest qualifier: Venigalla & Chimalakonda found Why has no statistically
significant association with popularity. It is a legitimacy signal, not a growth
lever.

**This one cannot be written for you.** Why a local-first single-owner platform
rather than the hosted assistants; why the tool gate is enforced in code rather
than prompted; why eight ported apps rather than one. Two short paragraphs.

### M4 · FUNCTIONAL — The package still carries `uv init` placeholder identity

```
where:    pyproject.toml:2-4
observed: name = "bdgrskills"           ← not this project
          description = "Add your description here"
          (no license field)
why:      It is the metadata every Python tool prints, and "Add your description
          here" is the most legible possible signal that nobody looked. It is
          also three lines from the top of the file a reader opens second.
fix:      name = "mango-tree", the profile one-liner as description,
          license = "MIT".
effort:   mechanical, 5 min
```

### M5 · FUNCTIONAL — The published repository is three weeks behind

```
observed: git rev-list --count origin/main..main → 16
          gh repo view → pushedAt 2026-08-10
          local HEAD 2026-08-31
why:      Everything a visitor sees — including the README this audit just
          verified, the UI overhaul, and the LLM provider layer — is absent from
          the published repo. Any fix from this plan is invisible until pushed.
fix:      push. Named here because a plan whose output nobody can see is not a
          finished plan.
```

### M6 · FUNCTIONAL — The primary database is a dotfile named "test"

```
where:    config/django/settings.py:61
observed: DATABASES["default"]["NAME"] = BASE_DIR / ".django-test.sqlite3"
          It holds the owner account, sessions, the security audit log, the LLM
          provider/key records and the whole imdbspy schema.
conflicts with:
          README.md:13  "SQLite databases and files under `data/`"
          README.md:207 "data/ — gitignored runtime state: artifacts, SQLite"
why:      Three problems in one line. The README's storage claim is wrong for the
          most important database. It is the only DB with no MANGO_*_DB override,
          so it cannot be relocated for tests or deployment the way the other
          five can. And a hidden file with "test" in its name holding the only
          copy of the owner's credentials and security log is a file someone
          eventually deletes during a cleanup.
fix:      Move to data/mango.sqlite3 with a MANGO_DEFAULT_DB override, or — if
          the name must stay for compatibility with an existing local database —
          correct README:13 and document it in config/README.md as deliberate.
          The path is a data migration, not a rename; it needs your call.
effort:   needs your decision. Not mechanical.
```

---

## 5. Minor

| # | Tier | Finding | Where |
| --- | --- | --- | --- |
| m1 | SURVEY-DATA | The status statement — the "When" section, missing from 79% of READMEs and present here — is at line 279 of 288. It answers the reader's live question ("is this real, is it maintained, how much works") after they have already decided. It belongs in the first screen. | README.md:279 |
| m2 | CONVENTION | The layout tree omits `docs/assets/`, `docs/misc/`, three files in `docs/`, and `utils/scripts/`. A hand-drawn tree is drift with a countdown; it should list only what a reader must know. | README.md:204 |
| m3 | FUNCTIONAL | Setup has no prerequisites line. `uv`, Python 3.13, Node and git are mentioned once, in a stack table four sections earlier, and never as "install these first." The reader hits `uv sync` with no uv. | README.md:82 |
| m4 | CONVENTION | `git clone <repository-url>` — a placeholder in the first command on the page, in a repo that has a known remote. | README.md:85 |
| m5 | CONVENTION | Three documents sit in `docs/` linked from nothing: `audit-report.md`, `audit-profile.yaml`, `overhaul-plan.md`. The README's Documentation table lists four documents and none of these. `overhaul-plan.md` reads as current work; it is finished. | docs/ |
| m6 | CONVENTION | No CI, and no `.github/` at all. Recommended **for what it does, not how it looks**: a job that runs the documented setup path on a clean runner would have caught B1 and B2 the day they appeared. There is no hiring-side evidence that a green badge influences anything. | — |
| m7 | EMPLOYER-WRITTEN | Front page unset: no topics, no social preview image (`usesCustomOpenGraphImage: false`, so every shared link renders as a generic avatar card), no About website. Ten minutes, and the social preview is the most-skipped item on the list. | GitHub settings |
| m8 | FUNCTIONAL | Three tests fail identically in the container and on your machine — `test_coordinator_graph.py::test_read_artifact_*`, all three "manifest does not exist". A permanently red suite trains everyone to ignore red. | utils/tests/agents/test_coordinator_graph.py:339 |
| m9 | CONVENTION | `docs/skills/` is symlinked into `.claude/`, `.cursor/` and `.codex/`, so three copies of eight skill trees appear in `git ls-files` and in a reader's first look at the root. Documented and deliberate — noted so the restructure does not "tidy" it. | .claude/ .cursor/ .codex/ |

---

## 6. Advisory — judgement, stated so it is not re-raised

- **Python flat layout is fine here.** `src/` prevents import shadowing for
  *installable* packages; this is an application run from its own root, and
  `utils/` + `web/` + `config/` is legible at a glance. Not a finding. PyPA
  documents both.
- **`CONTRIBUTING.md` was theatre while this was solo; it is not any more.** You
  named public users as a reader. The README's contributing section already
  contains the real content (step-and-commit, no AI attribution, the four hard
  rules) — it is delegated to `docs/skills/global/SKILL.md`, which is a 1,000-line
  agent skill, not a contributor guide. A short root `CONTRIBUTING.md` that links
  to it is now worth having.
- **`SECURITY.md` is usually theatre; here it is defensible.** This handles IMAP
  passwords, OAuth refresh tokens, Strava tokens and provider API keys. If people
  self-host it, one line on how to report a hole is proportionate.
- **`CHANGELOG.md`: not yet.** No releases, no versions. It would be noise.
- **No badges.** Zero is a fine number. Once CI exists, one Actions badge and one
  licence badge is the cap worth having; stats cards, streaks and trophies are
  empirically uncorrelated with ability and are part of a documented fake-profile
  signature — never add them.
- **Do not add MLflow/W&B/DVC, type-hint sweeps, or Docker "to look
  professional."** Zero hiring-side evidence for any of them. Docker here would
  be justified by runnability alone, and B1/B2's bootstrap fix is cheaper.
- **`docs/misc/canva|fsu|pulse` are not orphans.** They are cited by
  `docs/skills/ui-frontend/`. Left alone.
- **The eight `docs/skills/` trees are governing rules**, not documentation. A
  restructure that moves paths must update all eight or the repo contradicts its
  own instructions — `audit_docs.py --governing --strict` is the gate.
- **`docs/audit-report.md` and `docs/overhaul-plan.md` are historical records.**
  They describe the repository as it was on 2026-08-31 and must be corrected by
  appending, never by editing paths to match a later tree.

---

## 7. What was checked, and what was not

Stated as deliberately as the findings, because a tool's silence is not a pass.

**Checked:** `audit_structure.py --detect --secrets --history` (2,129 files,
113.5 MB tree, no secret-shaped strings in the working tree or in history);
`audit_docs.py --all` (every relative link, path token, fenced command and tree
diagram); `audit_readme.py`; `audit_assets.py`; `check_links.py --all` (3/3
external URLs live); a clean-clone container run of every documented command; and
`gh repo view` for the front-page metadata.

**Not checked:**

- **`cd web && npm install`, and the frontend build and tests.** The container
  had no Node. Untested, not passed.
- **macOS and Windows.** One Linux container, one architecture. The
  `link-skills.ps1` path in particular is unexercised.
- **Whether the code is good.** This audits presentation, structure, runnability
  and honesty. A well-structured repo of bad code passes every check here, and
  a code review is a separate instrument.
- **Prose truth beyond the countable.** Every number and path in the README was
  verified. Whether a paragraph describes an architecture the code has since
  moved past is not machine-checkable, and only the eight most substantive claims
  were read against the code by hand.
- **The rendered UI.** Out of scope here — see `docs/audit-report.md`.
- **Anything about the private history of deleted branches or forks.**

**And what this cannot tell you:** whether restructuring helps you get hired. The
best study in the space had 76 recruiters produce ~2,200 evaluations validated
against real interview outcomes and got **55% accuracy**, with "worked at a top
firm" the strongest predictor. What is well supported is the asymmetry: hiring
managers report passing *on* candidates because of a GitHub far more often than
hiring them because of one. This work is downside elimination. That is the honest
frame, and it is why B1–B4 outrank everything cosmetic.

---

## 8. Measurements — the diff target for a re-audit

| Measure | 2026-08-31 |
| --- | --- |
| Tracked files / working tree | 815 / 16 MB of tracked content (the 113.5 MB working tree is mostly gitignored `data/` and `NewApps/`) |
| Clean-clone setup | **fails at step 6 of 7** |
| Steps to first run | 7 |
| `uv sync --extra dev` | 11.7 s |
| Clean-clone test result | 3 failed · 459 passed · 170 errors · 41 s |
| README | 288 lines, 13 sections, 0 badges, 1 image |
| README funnel: what / visual / status / why | line 7 / 2 / 279 / **absent** |
| Committed showcase assets | 1 (SVG logo, 212 KB) |
| Internal links / external links | 13 / 3 — all resolve |
| Stale doc paths | 0 |
| Secrets in tree or history | none found |
| LICENSE · topics · social preview | absent · none · none |
| Commits unpushed | 16 |

---

## 9. Re-audit — Stages 1-3 applied, 2026-08-31

Same instruments, same commands, so these are comparable numbers rather than an
impression. Stages 4-7 are untouched.

### The runnable gate

Clean `git clone` into `node:22-bookworm` with uv installed, one command:

| | Before | After |
| --- | --- | --- |
| Steps to first run | 7 | **1** (`./scripts/bootstrap`) |
| Clean-clone setup | **fails at step 6** | **passes, 29.5 s** including `npm install` |
| `migrate --database=imdbspy` | `OperationalError` | OK |
| `uv run pytest` | 3 failed · 459 passed · **170 errors** | **65 failed · 567 passed · 0 errors** |

**The gate passes.** B1 is closed outright. B2 is closed as far as it can be
without a decision from you: the 170 errors were a missing schema and are gone,
and the 65 remaining failures are a different problem the first one was hiding —
those tests assert against *rows* in the legacy databases (`EXPECTED_COUNTS
["workouts"] == 7`, a seeded category taxonomy), so they can only pass on an
install holding that data. See §10.

Verified separately: `init_data.py` run against this working install created
nothing and changed nothing (`left alone: 4`), and the local suite is unmoved at
9 failed / 623 passed.

### Findings closed

| # | Was | Now |
| --- | --- | --- |
| B1 | setup fails on clean clone | fixed — `utils/scripts/init_data.py` |
| B2 | 170 test errors | 170 → 0; 65 data-dependent failures remain, §10 |
| B3 | no LICENSE | MIT at root, `license = "MIT"` in `pyproject.toml` |
| M1 | 7 steps, no entrypoint | `scripts/{bootstrap,server,test}` |
| M4 | `bdgrskills` / "Add your description here" | named, described, licensed |
| M6 | README claimed all SQLite lives under `data/` | corrected in `README.md` and `config/README.md`, which now also says the "test"-named file is not a test artifact |
| m2 | layout tree missing four entries | trimmed and corrected |
| m3 | no prerequisites line | git · uv · Python 3.13 · Node, above the command |
| m4 | `git clone <repository-url>` | the real remote |

`audit_structure.py` hygiene row is now
`license: LICENSE · contributing: CONTRIBUTING.md · security: SECURITY.md`.
`check_links.py`: 23 internal, 3 external, **all resolve** — one link written
during this work (a GitHub advisory URL) was caught by the check as a 404 on a
private repo and replaced with prose before it was committed.

### Still open

| # | Why it is still open |
| --- | --- |
| B4 | the About description — **blocked on your wording** |
| M2 | no screenshots — Stage 5, needs credentials or a throwaway instance |
| M3 | no Why — **blocked on you**; `audit_readme.py` still reports it |
| M5 | now 20 commits unpushed |
| m1 | status is at line 271 of 284 — moving it is part of the Stage 5 rewrite |
| m5, m6, m7 | Stages 4, 6, 7 — not started |
| m8 | the three `read_artifact` tests are still red |

---

## 10. The finding that only appeared once B2 was fixed

```
[MAJOR · FUNCTIONAL] 65 backend tests require the maintainer's own data
  where:    utils/tests/utils/apps/{exercise,projectmanager,timekeeper}/
  observed: assert Workout.objects.count() == EXPECTED_COUNTS["workouts"]
            → assert 0 == 7
            ValueError: max() iterable argument is empty
            test_get_categories_returns_seeded_taxonomy → []
  why:      These assert against rows in the databases the three apps were
            migrated from. Schema is no longer the problem; content is. Nobody
            who clones this repo can make them pass, which means the suite is
            permanently red for every reader — and a permanently red suite
            trains everyone to stop reading it.
  three ways out, and it is your call:
    (a) ship a small non-personal sample dataset that init_data.py seeds, and
        recalibrate the count assertions against it. Most honest; most work.
    (b) mark them `@pytest.mark.needs_legacy_data` and skip when the bound
        database is empty. They stay green where the data exists and report as
        skipped, with a reason, where it does not. Cheapest; ~65 annotations.
    (c) leave them, and keep the README paragraph that explains the 65.
        Applied today, and the correct interim state either way.
  effort:   (b) is ~2 h and is my recommendation.
  ⚠ BLOCKED ON YOU
```

---

## 11. Re-audit — Stages 4-7 applied, 2026-08-31

### The pipeline the CI workflow now runs, from a clean clone

`node:22-bookworm` + uv, nothing preinstalled, documented commands only:

| Step | Result |
| --- | --- |
| `./scripts/bootstrap` | **35.4 s** |
| `uv run pytest` | **570 passed · 62 skipped · 0 failed** |
| `cd web && npm test` | **145 passed** |
| `cd web && npm run build` | **built in 5.6 s** |

That is the whole of `.github/workflows/ci.yml`, so the workflow is not a guess
about what passes — it is a recording of a run that did.

### Findings closed since §9

| # | Was | Now |
| --- | --- | --- |
| B4 | About said "a fully autonomous agentic system" | replaced with the profile one-liner; `gh repo view` confirms |
| M2 | no visual proof | four screenshots in `docs/assets/`, generated by a committed script |
| M3 | no Why | `README.md` § "Why it exists", two paragraphs, at line 30 — **draft, needs your read** |
| M6 (half) | `default` was the only DB with no override | `MANGO_DEFAULT_DB` added; the path itself is unchanged and still your call |
| m1 | status at line 271 | line 24, in the first screen |
| m5 | three docs linked from nothing | in the README's Documentation table, marked as records |
| m6 | no CI | `.github/workflows/ci.yml` — the setup-path job, which is the one that keeps the README honest |
| m7 (part) | no topics | ten topics set |
| m8 | three permanently red artifact tests | build their own store; 18/18 green |
| §10 | 65 tests red for every reader | 62 marked `needs_legacy_data` and skipped with a reason; 3 fixed outright |

README funnel, measured by `audit_readme.py`:

| | Before | After |
| --- | --- | --- |
| What is this | line 7 | line 7 |
| Something visual | line 2 (logo only) | line 2 (logo) + line 19 (hero screenshot) |
| Status | line 279 | **line 24** |
| Why | **absent** | **line 30** |

`audit_readme.py` reports no findings. `check_links.py`: 34 internal, 3
external, all resolve. `audit_structure.py` hygiene: `LICENSE`,
`CONTRIBUTING.md`, `SECURITY.md` all present.

### What is left, and none of it is mine to do

| | |
| --- | --- |
| **Read the Why** | Two paragraphs written from what the code and the README already argue — that a hosted assistant cannot reach your data, that a folder of self-hosted apps cannot reason across it, and that the gate is in code because the agent can do anything you can. If any sentence is not how you would put it, change it: it is the paragraph an interviewer asks about. |
| **Push** | 26 commits ahead of `origin/main`, which was last pushed 2026-08-10. Everything above is invisible until then. |
| **Upload the social preview** | `docs/assets/social-preview.png`, 1280×640, 115 kB → Settings → Social preview. The only front-page item with no API. |
| **Decide on `.django-test.sqlite3`** | The override exists now; whether the file moves under `data/` is a data migration over your live install, and still §4 M6 (b). |
| **Decide whether it goes public** | The licence, the contributor guide and the security policy are all in place for it. The switch is yours. |

### Deliberately not done

- **No hosted demo.** The employer-written evidence rates a working live demo
  above everything else in the showcase — and this project is single-owner and
  holds your mail, so it cannot honestly have one. The screenshots are the
  fallback, and the honest substitute for the demo is a short video of the tool
  gate refusing and then allowing a request. That is the project's actual idea
  and no still image carries it.
- **No badges, no emoji headings, no decorative dividers.** Together they are
  the recognisable signature of a generated README, which on a reviewer who has
  seen a few is a negative signal.
- **No CODE_OF_CONDUCT, issue templates, CODEOWNERS or CHANGELOG.**
- **`docs/misc/`, `docs/skills/` and the three skill symlink trees untouched.**
