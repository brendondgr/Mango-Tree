---
name: website-architecture
description: Use this skill when planning, documenting, scaffolding, or changing the Mango Tree React/Vite frontend, including routes, workspace tabs, data flow, API boundaries, and frontend/backend contracts.
---

# Mango Tree Website Architecture

The control surface for the platform: a React/Vite SPA under `web/` that
consumes DRF endpoints through TanStack Query.

## Installed libraries

Use these. Do not import anything not on this list without adding the dependency
first.

- **TanStack Router** — routing. Not react-router.
- **TanStack Query** — server-state caching.
- **Zustand** — UI state.
- **Tailwind CSS v4** and **shadcn/ui** (new-york) — components.
- **Radix UI** — accessible primitives.
- **Framer Motion** — transitions.
- **react-markdown** with **rehype-highlight** — agent output rendering.
- **Vitest** and **Testing Library** — tests.

Not installed, despite older docs referencing them: React Hook Form, Zod,
Recharts, cmdk. There is no form library, no validation library, no chart
library, and no command-palette library in this project.

## Routes

The router (`web/src/app/router.tsx`) has five routes and that is deliberate:

```text
/            → redirect to /chat
/login       → LoginPage
/signup      → SignupPage
/onboarding  → OnboardingPage   (AuthGate, requireOnboarded: false)
/chat        → ChatPage         (AuthGate)
```

**Apps are not routes.** An app is a tab inside `/chat`. Settings, security, and
app-enablement are panels in the workspace. Do not add a top-level route for a
feature — add a workspace app or a panel.

## `/chat` workspace tabs

`WorkspaceHeader` shows one pinned **Apps** home tab plus a closeable **app tab**
per open app. Apps come from the registry at
`web/src/features/workspace/apps/appRegistry.tsx` — a single entry (`id`,
`label`, `description`, `icon`, `Component`) wires an app into the launcher,
header tabs, nav-rail quick-launch, and main-body routing at once.

When no app tab is active the Apps overview shows. Opening an artifact from the
Artifacts tab spawns one non-persisted **ephemeral tab** for the viewer. Open
tabs do not survive a reload. See `docs/platform.md` for lifecycle details.

## Data flow

```text
web/src/services/  →  utils/api/routes/  →  utils/apps/{app}/backend/services/
```

No business logic in the frontend beyond API clients. App-specific UI lives in
`utils/apps/{app}/frontend/` and is imported through the Vite aliases in
`web/vite.config.ts` — adding an app means adding an alias in both
`vite.config.ts` and `tsconfig.json`.

Real endpoints exist for all eight apps and for auth; `docs/api.md` is the
contract. Do not call an endpoint that is not listed there.

## Auth

Implemented, and the frontend must respect it. `AuthGate` wraps protected
routes: unauthenticated visitors go to `/login`, and a signed-in owner who has
not completed onboarding goes to `/onboarding`. Requests carry the session
cookie automatically; state-changing calls must send `X-CSRFToken` from the
`csrftoken` cookie. `web/src/lib/http.ts` handles this — use it rather than bare
`fetch`.

## Before expanding the UI

Update the relevant sections of `docs/platform.md` (route map, component map,
data flow) and `docs/api.md` (endpoints) in the same change.

## Commands

```bash
cd web && npm install
```

```bash
cd web && npm run dev
```

```bash
cd web && npm test
```

```bash
cd web && npm run build
```

`npm run build` type-checks with `tsc --noEmit` before building, so a type error
fails the build.
