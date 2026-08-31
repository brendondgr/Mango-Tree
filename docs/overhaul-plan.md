# Website overhaul — implementation plan

> **Status: complete.** Every phase below has landed. The measured before/after
> is in [`docs/audit-report.md`](audit-report.md) §5 — headline numbers: the
> mobile gate goes 2/7 → 7/7, overflowing elements at 360px 542 → 0, axe
> violations 30 → 1, initial bundle 3,282 kB gzip → 326 kB, frontend tests
> 75 → 145. This document is kept as the record of what was planned and why.

**Goal.** Restructure and rebuild the Mango Tree web UI so it is clean, modern,
structured, and genuinely usable on a phone — and so the chat feature can talk to
any LLM provider, configured entirely from the web UI.

**Priorities, in the owner's order.**

1. Mobile friendliness.
2. Clean, structured, modern layout with entrance choreography ("pizazz").
3. Full restructure of the ported app UIs onto one design language.
4. In-browser management of LLM providers, keys, and models.
5. Keyboard operability (stated nice-to-have; built in per phase, not deferred).
6. SEO — explicitly out of scope.

Scope record: [`docs/audit-profile.yaml`](audit-profile.yaml).
Findings: [`docs/audit-report.md`](audit-report.md).

---

## The finding that sets the order

The app does not work on a phone today. Verified at 390×844 with real taps:

| Check | Result |
| --- | --- |
| Tap an Apps launcher card | Hits `div.flex.h-full.shrink-0` — a `position:fixed`, 844px-tall, transparent wrapper. Playwright `.tap()` times out. |
| Open the chat drawer, tap the composer | Hits `button.fixed.inset-0.z-[90]` — the backdrop, which paints *above* the drawer it reveals. |
| Type a message | Fails. The chat cannot be used at all below 820px. |
| Send button position | `bottom: 867px` in an 844px viewport — off-screen. |

Everything below 820px is inert except the top bar. That makes Phase 3 the
first phase that changes user-visible behaviour, and it is why the design
foundations in Phases 1–2 come before any surface work: they are what the shell
rebuild is written against.

---

## Layers affected

`web` (shell, primitives, tokens, chat) · `utils/apps/{8 apps}/frontend` ·
`utils/shared/llm` · `utils/agents` · `utils/api/routes` · `config` · `docs`

Backend business logic under `utils/apps/*/backend` is untouched except where a
UI fix requires it. No migrations for exercise, projectmanager, or timekeeper —
their models bind `managed = False` to databases a previous app created.

---

## Phase 0 — Audit deliverables and a repeatable verification harness

The whole plan rests on re-measurable claims, so the measuring tool ships first.

| Step | Change |
| --- | --- |
| 0.1 | `docs/audit-profile.yaml` — the scope record (done) |
| 0.2 | `docs/audit-report.md` — findings, severity-ordered |
| 0.3 | `utils/scripts/audit_ui.py` — authenticated Playwright audit: axe-core, overflow, touch targets, focus order, per-viewport screenshots |
| 0.4 | `utils/scripts/verify_mobile.py` — the four hit-tests above, as a pass/fail gate |

**Acceptance.** `audit_ui.py` runs against a logged-in session and emits JSON +
screenshots for 9 surfaces × 5 viewports. `verify_mobile.py` exits non-zero
today (it must, or it is not measuring anything) and exits zero after Phase 3.

---

## Phase 1 — Design foundations (`web/src/styles`, `web/src/lib`)

Systemic fixes first: one change here resolves findings across every surface.

| Step | Change | Fixes |
| --- | --- | --- |
| 1.1 | Geometry + z-scale tokens in `globals.css` `@theme`: `--rail-w`, `--rail-h`, `--header-h`, `--sidebar-*`, and `--z-header/rail/backdrop/drawer/popover`. Register a `compact` variant so `max-[820px]:` disappears. | 5 ad-hoc z-values; 4 places re-deriving the breakpoint |
| 1.2 | Theme-aware elevation scale (`--shadow-sm/md/lg/xl`) replacing Tailwind's `shadow-*`, which is invisible on the 4 dark themes | Dialogs/popovers float with no separation in dark themes |
| 1.3 | Split `--ring` from `--primary`; give every theme a focus ring that clears 3:1 | Focus ring invisible on `dark` and `fsu-dark` — defeats keyboard use |
| 1.4 | Motion tokens with **reduced-motion as the base state**: travel and stagger are `0` by default and only opt in under `prefers-reduced-motion: no-preference` | Blanket `*` reset cannot reach framer-motion; per-file `reduce` branches |
| 1.5 | Typography and spacing scale; surface layering tokens (`--surface-1/2/3`) | No scale exists; every app picks its own sizes |
| 1.6 | Contrast guard in `colorPalette.ts` — derive `--primary-foreground` from the chosen `--primary` instead of pinning it to white | 53 of 96 preset × theme combinations are currently unreadable, including the app's own "Mango" preset |
| 1.7 | Extend `themeContract.test.ts` to assert every new token exists in all 8 themes, and add a contrast assertion | Prevents drift |

**Acceptance.** `npm test` green with the extended contract test; a contrast
script reports 0 failures for `foreground/background`, `primary-foreground/primary`
and `ring/background` across all 8 themes.

---

## Phase 2 — Shared primitives (`web/src/components/ui`, `web/src/components/app-shell`)

The apps hand-roll these today, which is why they look like different products.

| Step | Primitive | Replaces |
| --- | --- | --- |
| 2.1 | `skeleton.tsx` (+ `SkeletonCard/Row/Grid`) | 17 bare "Loading…" text swaps |
| 2.2 | `empty-state.tsx` | 5+ bespoke empty blocks |
| 2.3 | `field.tsx` + `useFormErrors` — labels, `aria-invalid`, `aria-describedby`, focus-on-error | Per-screen re-implementation; no field-level errors anywhere |
| 2.4 | `select.tsx` (Radix), `confirm-delete.tsx` | 4 raw `<select>`s, 3 `window.confirm` calls |
| 2.5 | `segmented-control.tsx` with roving tabindex | 4 competing tab languages across apps |
| 2.6 | `master-detail.tsx` — side-by-side above the breakpoint, push navigation below | 3 ad-hoc answers; fixes mailbox, projects, recipes, calendar on mobile |
| 2.7 | `sheet.tsx` — bottom sheet with scrim, focus trap, safe-area padding | Needed by the Phase 3 mobile model |
| 2.8 | `async-boundary.tsx` — skeleton / error+retry / empty in one wrapper | 22 surfaces with a half-filled state matrix |
| 2.9 | `app-shell/AppHeader`, `StatusBadge` | Per-app headers and badges |
| 2.10 | Fix `dialog.tsx`: `max-h` + internal scroll + real open/close animation (the current animation classes are dead — no animate plugin is installed) | Tall dialogs lose title *and* footer on a phone; every overlay is a hard cut |
| 2.11 | Touch-target floor on `button`/`input`: `h-11 text-base` compact, `h-9 text-sm` at `md`+ | Every input is 14px → iOS auto-zooms on the first tap of the login form |

**Acceptance.** Each primitive has a render test; `audit_ui.py` reports 0
sub-24px targets and 0 sub-16px inputs on surfaces already migrated.

---

## Phase 3 — Shell rebuild, mobile-first (`web/src/app`, `web/src/features/workspace`)

The chosen model: **one slim top bar + a bottom tab bar**, replacing two stacked
bars. App switching and tab management move into bottom sheets.

| Step | Change |
| --- | --- |
| 3.1 | `useShellLayout()` — the single consumer of the breakpoint and the store |
| 3.2 | `AgentWorkspaceLayout`: kill the full-viewport fixed wrapper, apply the z-scale, switch `h-screen` → `h-[100dvh]` |
| 3.3 | Mobile: slim top bar (context title + settings) + bottom nav (Chat · Apps · Current · More) with `env(safe-area-inset-bottom)`; add `viewport-fit=cover` to `index.html` |
| 3.4 | `WorkspaceSidebarShell`: correct heights, minimum width, and `inert` when collapsed so its ~12 controls leave the tab order |
| 3.5 | `WorkspaceHeader`: horizontal tab scroller with an animated indicator; mobile tab list becomes a bottom sheet |
| 3.6 | `ChatNavRail`: desktop rail with tooltips and 44px targets |
| 3.7 | Skip link to main content; one `<h1>` naming the active surface; fix duplicate/nested `main` landmarks |

**Acceptance.** `verify_mobile.py` exits 0: the Apps card is tappable, the
composer is typable, the Send row is inside the viewport, and no tap is
intercepted. `audit_ui.py` shows no element past the right edge at any viewport.

---

## Phase 4 — Chat surface (`web/src/features/chat`)

| Step | Change |
| --- | --- |
| 4.1 | Composer: 16px input, no placeholder clipping at narrow widths, reachable action row |
| 4.2 | Consolidate the three attachment components into one |
| 4.3 | Fix the agent-store subscription leak that survives every errored turn and force-scrolls forever |
| 4.4 | Live region for streaming output; keyboard path for every mouse action |
| 4.5 | Empty state and streaming choreography on the Phase 1 motion tokens |

**Acceptance.** Chat is fully usable at 360px; a failed turn leaves no live
subscriber (unit test); axe reports no violations on the chat surface.

---

## Phase 5 — Landing, auth, onboarding, settings

| Step | Change |
| --- | --- |
| 5.1 | `AppsOverview` → structured landing: status strip, "Continue" band, `auto-fill` launcher with one live datum per app, staggered entrance, skeletons |
| 5.2 | Login/signup → two-pane branded entry; above the fold at 360×640; password reveal; caps-lock hint |
| 5.3 | Onboarding → paced steps with grouped apps, select-all, sticky action bar |
| 5.4 | Settings → full-screen sheet with list-detail on mobile, sidebar+detail on desktop; URL-driven; fixes the clipped Colors and Security panels |

**Acceptance.** All four surfaces pass axe and the responsive matrix at
320/360/390/768/1280/1920.

---

## Phase 6 — App modules: full restructure (`utils/apps/*/frontend`)

The owner's decision: these are ported legacy UIs, structurally poorly managed,
and should be **restructured**, not merely patched. `media_viewer` is the
reference implementation — zero bespoke CSS, explicit loading/error/empty states.

Per app: migrate onto the Phase 2 primitives, adopt container queries so panes
reflow to the *panel* rather than the window, add skeletons and empty states,
give every pointer-only interaction a keyboard path, and replace hardcoded hex
with theme tokens.

| App | Headline work |
| --- | --- |
| `mailbox` | `MasterDetail`; compact list's 474px hard minimum; `aria-hidden` drawer with ~20 focusable controls |
| `exercise` | 5-column dashboard matrix that overflows at every phone width; routine builder is HTML5-drag-only — no touch, no keyboard |
| `calendar` | Day/3-day mode; 224px sidebar squeezing the week grid to ~7px per column; month view → dot chips |
| `imdbspy` | 973-line stylesheet → primitives; hover-only *destructive* delete over every poster |
| `recipes` | `MasterDetail` + filter Sheet; 256px sidebar + 220px grid floor overflow below ~510px |
| `timekeeper` | Paint grid: keyboard path for 288 blocks, touch drag, working erase mode; logs table scroller |
| `projectmanager` | 676-line stylesheet → primitives; register in Tailwind `@source` (4 utilities silently dropped today); keyboard-selectable category suggestions |
| `media_viewer` | Already the reference — align to new primitives only |

**Acceptance, per app.** No horizontal clipping at 320–412px; axe clean;
every interaction reachable by keyboard; loading/error/empty states present.

---

## Phase 7 — Performance (`web/vite.config.ts`, import sites)

Measured baseline: one **7,855 kB** JS chunk (3,251 kB gzip). Ordered, each step
verified against `dist/assets`.

| Step | Change | Expected |
| --- | --- | --- |
| 7.0 | `manualChunks` (react/tanstack/radix) + `chunkSizeWarningLimit` | cache boundary |
| 7.1 | `js-tiktoken` barrel → `/lite` + dynamic `cl100k_base` | −2,504 kB gzip |
| 7.2 | Lazy the 8 app workspaces in `appRegistry` | −81 kB gzip |
| 7.3 | Dynamic-import `pdfjsSetup` | −139 kB gzip |
| 7.4 | Lazy markdown boundary; narrow `rehype-highlight` languages; katex CSS into the async chunk | −241 kB gzip |
| 7.5 | Lazy auth routes; SVGO the two logos (274 kB of SVG today) | entry ≈ 250 kB |

**Acceptance.** Initial route ≤ 250 kB gzip, enforced by a size check in CI.

---

## Phase 8 — Multi-provider LLM, managed from the browser

**Owner's requirement:** add and edit API keys, choose the server, and manage
every setting from the web UI.

**Design note.** Browsers cannot call `api.anthropic.com` / `api.openai.com`
directly — cross-origin preflight is refused — and the key currently lives in
`localStorage`, readable by any script on the origin. So the *management surface*
is fully in the browser, while *storage and transport* are server-side. This is
the only shape that both satisfies the requirement and works.

| Step | Layer | Change |
| --- | --- | --- |
| 8.1 | `utils/shared/llm` | Port the `llmkit` provider abstraction (registry, discovery, params, retry + adapters for OpenAI-compatible, Anthropic, Gemini, Ollama). Wire its 130-check selftest into pytest. |
| 8.2 | `config` + `utils/apps` | Provider registry: built-in kinds from `config/models.yaml`, owner-defined providers and keys in the database, owner-scoped and never returned to the client in plaintext |
| 8.3 | `utils/api/routes/llm.py` | `GET /providers/`, `GET /models/?provider=`, `POST /test/`, `POST /count-tokens/`, and CRUD for owner-defined providers. Discovery returns `200 {ok:false, error}` when a box is off — never a 500 |
| 8.4 | `utils/agents` | Rewrite `reason_node` against the abstraction; replay the provider's own assistant turn verbatim (Anthropic thinking signatures / Gemini thought signatures) and correlate tool results by `tool_call_id`; delete the fabricated-answer fallback that currently turns a 401 into a confident fake reply |
| 8.5 | `web` | Provider manager UI: add/edit/delete providers, paste and rotate keys, live model dropdown with refresh, connection test with a real round-trip, per-provider generation defaults. Remove `apiKey`/`baseUrl` from `localStorage`; delete the `/v1` and `/tokenize` Vite proxies |

**Acceptance.** Denial tests: unauthenticated requests to every `/api/llm/`
route are refused; a key is never echoed back in a response body; an unreachable
provider yields `ok:false`, not a 500. `docs/api.md` documents the contract
before the frontend calls it.

---

## Phase 9 — Verification, docs, merge

Re-run the full audit and report it as a **diff** against the Phase 0 baseline —
per the audit skill, a fix nobody re-tested is an assumption again. Update
`docs/platform.md`, `docs/api.md`, and the per-directory READMEs. Merge to
`main`, then remove the worktree.

---

## Test plan

| Layer | Gate |
| --- | --- |
| Frontend unit | `cd web && npm test` — extended with primitive render tests, the theme/contrast contract, the layout contract (`clampSidebarWidth`, `selectSidebarCollapsed`), and the stream parsers, which have zero coverage today |
| Build | `cd web && npm run build` — `tsc --noEmit` clean, bundle budget enforced |
| Backend | `uv run pytest` — including the llmkit selftest and `/api/llm/` denial tests |
| Rendered site | `utils/scripts/audit_ui.py` — axe, overflow, touch targets, focus order across 9 surfaces × 5 viewports |
| Mobile gate | `utils/scripts/verify_mobile.py` — real taps, not assertions about CSS |

Every phase ends with its gate green and one commit per validated step.

---

## Assumptions

1. The visual identity — Mango purple, the 8 themes, the tab-workspace concept —
   is kept. "Cleaner and more modern" means structure, spacing, elevation, and
   choreography, not a new palette.
2. The per-app *look* may change where restructuring requires it; the owner
   asked for this explicitly.
3. `data/` is gitignored, so this worktree runs on schema-only clones of the
   legacy SQLite databases. No personal data is copied, and no migration is ever
   generated for the three `managed = False` apps.
4. Hosted-provider support ships behind config: a fresh clone with no keys still
   runs offline against a local endpoint.
