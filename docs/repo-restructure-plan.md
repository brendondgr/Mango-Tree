# Restructure plan — Mango Tree

**Date** 2026-08-31 · **Findings** [`docs/repo-audit.md`](repo-audit.md) ·
**Scope** [`repo-profile.yaml`](../repo-profile.yaml)

**Status: all seven stages applied, 2026-08-31.** The measured before/after is
in [`docs/repo-audit.md`](repo-audit.md) §9 (stages 1-3) and §11 (stages 4-7).
What is left is listed at the foot of §11 and is all yours: read the drafted
Why, push, upload the social preview, and decide on `.django-test.sqlite3` and
on visibility.

Approve per stage or per line; partial approval is normal and expected, especially around Stage 1 and Stage 6, which change what
the project *claims* rather than what it does.

Stages are ordered by dependency, not by effort. **Stages 1 and 2 merge on their
own** — they are pure corrections with no structural risk, and a repo that is
true and runs is already most of the way there. Nothing in this plan moves,
renames or deletes a source file; the repository layout was audited and found
appropriate (report §6).

---

## Stage 1 — Truth  ✅ applied, except the About line

Nothing here is cosmetic. Each item is a claim the repository does not back.

```
EDIT   pyproject.toml:2      name = "bdgrskills"  →  "mango-tree"
EDIT   pyproject.toml:4      description = "Add your description here"
                             →  the one-liner from repo-profile.yaml
EDIT   pyproject.toml        + license = "MIT"          (PEP 639 SPDX string)
MANUAL GitHub About sidebar  "A fully autonomous agentic system regrown using
                             the roots of my previous Mango Agent"
                             →  needs YOUR wording. Starting point:
                             "A local-first agent workspace: eight self-hosted
                              apps reachable both through a React UI and by a
                              LangGraph agent whose access is gated in code."
                             ⚠ BLOCKED ON YOU — I will not publish a description
                               of your project in words you have not approved.
DECIDE README.md:13          "SQLite databases and files under `data/`" is false
                             for the `default` database, which lives at
                             `.django-test.sqlite3` in the repo root (M6).
                             Two ways to make it true, and this is your call:
                             (a) correct the sentence and document the exception
                                 in config/README.md — 10 min, zero risk; or
                             (b) move the DB to data/mango.sqlite3 behind a
                                 MANGO_DEFAULT_DB override — a data migration
                                 over your live owner account, sessions, security
                                 log and LLM keys. Needs a backup and a tested
                                 path. Not bundled into this plan.
                             ⚠ BLOCKED ON YOU
EDIT   README.md:197-200     Say what `uv run pytest` actually does today: which
                             tests need seeded databases, and that three artifact
                             tests are known-red (m8). Removed once Stage 2 and
                             the artifact fixtures are fixed — until then the
                             README should not imply green.
```

**Not doing:** rewriting any prose that is already accurate. The README's voice
is yours and its claims check out; §2 of the report is the evidence.

---

## Stage 2 — Runnable  ✅ applied — the gate now passes (29.5 s, one command)

One root cause — `data/` is gitignored and nothing creates it — behind both
blockers and the seven-step setup. One entrypoint fixes all three.

```
NEW    scripts/bootstrap           executable; idempotent; creates
                                   data/{artifacts,imdbspy,exercise,
                                   projectmanager,timekeeper,recipes}/,
                                   runs uv sync --extra dev,
                                   cp -n .env.example .env,
                                   both migrate commands,
                                   cd web && npm install
NEW    scripts/server              python run.py
NEW    scripts/test                uv run pytest && (cd web && npm test)
```

Tool choice is yours — `scripts/` (Scripts to Rule Them All), a `Makefile`, or
`just`. The auditable property is *one documented entrypoint per verb*, not which
tool provides it. I have assumed `scripts/` because the repo already has
`utils/scripts/` conventions and no Make anywhere; say the word for a Makefile
instead.

```
DECIDE B2 — the 170 test errors                    ⚠ BLOCKED ON YOU
       The exercise/projectmanager/timekeeper fixtures shutil.copy a
       pre-existing SQLite file out of data/. Two fixes:
       (a) bootstrap seeds an empty schema file per app — mirrors what calendar
           and recipes already do on first run, keeps fixtures unchanged; or
       (b) the fixtures create the DB when the source is absent — no bootstrap
           dependency, but touches 3 conftest files and the managed=False
           binding you have rules about.
       (a) is my recommendation. Both are ~1-2 h. Neither may generate a
       migration for those three apps — README:264 and the app-modules skill are
       explicit that doing so corrupts real data, and this plan respects that.

FIX    utils/tests/agents/test_coordinator_graph.py — the three read_artifact
       tests, red in the container and on your machine alike (m8).
EDIT   README.md:82           + a prerequisites line: git, uv, Python 3.13, Node
EDIT   README.md:85           <repository-url> → git@github.com:brendondgr/Mango-Tree.git
EDIT   README.md:84-107       seven fenced blocks → `./scripts/bootstrap`, with
                              the manual sequence kept below in <details> for
                              anyone who wants it
EDIT   README.md:127-145      running → `./scripts/server`
EDIT   README.md:187-200      testing → `./scripts/test`
```

**Verify before merging** — this is the gate, so it is proved, not asserted:

```bash
python3 <repo-audit>/scripts/check_runnable.py . --from-clean-clone --container \
  --image ghcr.io/astral-sh/uv:python3.13-bookworm --time
```

---

## Stage 3 — Legal and hygiene  ✅ applied

```
NEW    LICENSE                MIT, © 2026 brendondgr        (your choice, B3)
NEW    CONTRIBUTING.md        ~40 lines: prerequisites, ./scripts/bootstrap,
                              ./scripts/test, the step-and-commit rule, the
                              no-AI-attribution rule, and a link to
                              docs/skills/global/SKILL.md for the full
                              convention set. Worth having now that public users
                              are a stated reader; it was theatre while solo.
NEW    SECURITY.md            ~10 lines: how to report, what is in scope. This
                              handles IMAP passwords, OAuth refresh tokens and
                              provider API keys, so it is proportionate here —
                              on most solo repos it would not be.
EDIT   README.md              a Licence line at the foot
```

**Not doing, and saying so because the advice you have read says otherwise:**
no `CODE_OF_CONDUCT.md`, no issue or PR templates, no `CODEOWNERS`, no
`CHANGELOG.md`. No community, no releases, no second owner — each of these would
be a file that exists to tick a box, and a reader who has seen a few recognises
them as exactly that.

---

## Stage 4 — Documentation  ✅ applied

Small. `audit_docs.py` reports zero stale paths, so this is about what a reader
can *find*, not about drift.

```
APPEND docs/overhaul-plan.md       a status banner at the top: COMPLETE,
                                   2026-08-31, superseded by the re-audit diff
                                   in docs/audit-report.md §5.
                                   ⚠ APPENDED, never edited in place. This and
                                     audit-report.md are historical records of
                                     the repo as it was; rewriting their paths
                                     to match a later tree would turn a true
                                     record into a false claim.
EDIT   README.md:269-277           the Documentation table gains the three
                                   unlinked documents (repo-audit.md,
                                   audit-report.md, overhaul-plan.md), the last
                                   two marked as historical. m5.
EDIT   README.md:204-223           trim the layout tree to what a reader must
                                   know, or add the four missing entries. m2.
                                   Trimming is the better answer — a hand-drawn
                                   tree is drift with a countdown.
KEEP   docs/misc/                  cited by docs/skills/ui-frontend/. Not orphaned.
KEEP   docs/skills/                symlinked into .claude/, .cursor/, .codex/.
                                   Moving it breaks all three. profile: do_not_move.
```

**Alternative considered and not proposed:** moving the audit documents into
`docs/audits/`. It reads slightly better and it rewrites the cross-links inside
two historical records for a cosmetic gain. Not worth the risk; say so if you
disagree.

---

## Stage 5 — README and showcase  ✅ applied — the Why is a draft for your review

The largest reader-facing change, and the one that most needs you.

```
CAPTURE docs/assets/*.png          3-4 screenshots at 1440px wide, shown at
                                   width="720": the chat workspace mid-stream,
                                   the apps launcher, one app tab (the timekeeper
                                   paint grid or the mailbox 3-pane), and a
                                   two-up of two themes.
                                   HOW: a small script beside
                                   utils/scripts/audit_ui.py, which already logs
                                   in and drives the authenticated workspace.
                                   ⚠ NEEDS FROM YOU: either MANGO_AUDIT_USER /
                                     MANGO_AUDIT_PASSWORD for a throwaway local
                                     account, or approval for me to stand up an
                                     instance against a temporary database and
                                     create one. I will not create an account on
                                     or capture from your real instance.
                                   ⚠ Screenshots of your workspace will show real
                                     mail, real calendar entries and real film
                                     ratings. Seeded/empty state, or your review
                                     of every image before it is committed.
WRITE  README.md — Why             two paragraphs. ⚠ BLOCKED ON YOU: why
                                   local-first rather than a hosted assistant;
                                   why the tool gate is enforced in code rather
                                   than prompted; why eight ported apps. An
                                   invented motivation is a claim you would have
                                   to defend in an interview and cannot. M3.
EDIT   README.md                   restructure the first screen for a reader who
                                   is deciding whether to keep going:
                                     logo + one-liner
                                     hero screenshot            ← new
                                     status, one honest line    ← moved up from :279
                                     Why                        ← new
                                     What's here (as today)
                                   Everything below stays in your order and your
                                   voice. Setup/config/testing detail moves into
                                   <details> where it is long.
```

**Not doing:** a badge row, emoji headings, decorative dividers, a "Features ✨"
section, or a hand-maintained table of contents. GitHub generates an outline from
the headings, and the rest is the recognisable signature of a generated README —
which on a reviewer who has seen forty of them is a negative signal, not a
flourish.

---

## Stage 6 — Front page  ✅ description and topics set; social preview generated, upload is yours

```
MANUAL About description          Stage 1. ⚠ BLOCKED ON YOU — B4.
MANUAL Topics                     lowercase, hyphenated, ≤20. Suggested:
                                  django · react · langgraph · llm-agent ·
                                  self-hosted · local-first · typescript ·
                                  personal-dashboard
MANUAL Social preview             Settings → Social preview. 1280×640, under 1MB.
                                  Without it every shared link — Slack, a DM to a
                                  recruiter — renders as a generic avatar card.
                                  Ten minutes, and the most-skipped item there is.
MANUAL Visibility                 the repo is PRIVATE. Stages 1-5 are worth doing
                                  either way; B3 (licence) becomes load-bearing
                                  only when it goes public.
                                  ⚠ YOUR CALL, and not one I will make.
PUSH   16 local commits           M5. Everything above is invisible until this.
```

---

## Stage 7 — CI  ✅ applied

```
NEW    .github/workflows/ci.yml   push + PR to main:
                                    permissions: contents: read
                                    ./scripts/bootstrap on a clean runner
                                    ./scripts/test
```

The valuable job is the one that runs the **documented setup path on a clean
runner** — it is what keeps the README true, and it would have caught B1 and B2
the day they appeared. There is no hiring-side evidence that a green badge
influences any reader, so this is on the list for its real reason or not at all.

---

## What this plan does not touch

- **No source file is moved, renamed or deleted.** Nothing in `utils/`, `web/`
  or `config/` changes except the two `.py`/`.toml` edits named above and the
  fixture fix in Stage 2.
- **No history rewrite.** The secret scan found nothing in the tree or in
  history, so there is nothing to rewrite for. `history_rewrite_allowed: false`.
- **No migrations for exercise, projectmanager or timekeeper.** Their models bind
  `managed = False` to databases a previous app created; the repo's own rules say
  a migration there corrupts real data, and Stage 2 works around it rather than
  through it.
- **`data/`, `NewApps/` and the skill symlinks are left exactly as they are.**

---

## Blocked on you — the list that gets dropped, restated

These are the highest-value items in the plan and they are the ones I cannot
write, because getting them wrong means putting words in your mouth that a reader
may probe:

1. **The Why**, two paragraphs (M3).
2. **The About description** (B4) — the only false claim on the front page.
3. **The `.django-test.sqlite3` decision** (M6) — correct the sentence, or move
   the database.
4. **The B2 fix choice** — seed at bootstrap, or seed in the fixture.
5. **Screenshot credentials or approval**, and a look at every image before it
   is committed.
6. **Whether this goes public**, and when.

---

## And the two things outside this plan that would help more

Said plainly because a restructure has a ceiling and this one is close to it:

- **Something a stranger can click.** A hosted demo is the single showcase
  element with employer-written scoring behind it, and this project — single
  owner, your mail, your calendar — cannot have one honestly. The nearest
  substitute is a **2-3 minute video walkthrough**: enable a tool group, watch
  the agent get refused, enable it, watch it succeed. That is the idea in this
  project, and no screenshot conveys it.
- **A writeup.** Consistently, across every credible practitioner in the space, a
  post explaining what you tried, what failed, and what you concluded does more
  than the code it describes. You have an unusual one to write: eight standalone
  apps absorbed into one platform, and a permission model enforced in code rather
  than prompted. The README is the shortest possible version of that post.
