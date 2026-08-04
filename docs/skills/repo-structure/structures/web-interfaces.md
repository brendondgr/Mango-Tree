# Web Interface Structure

The frontend is a React/Vite single-page application under `web/`. No Astro
remains anywhere in the project.

## Actual Layout

```text
web/
├── index.html
├── vite.config.ts          # port 5173, /api → 32553, /v1 → 9090, per-app aliases
├── package.json
├── components.json         # shadcn config (new-york)
├── tsconfig.json
└── src/
    ├── app/
    │   ├── router.tsx      # the whole route tree, a single file
    │   ├── providers.tsx
    │   ├── AuthGate.tsx
    │   ├── layouts/        # AgentWorkspaceLayout
    │   └── stores/         # zustand: auth, workspace, llmConfig, colorPalette
    ├── components/
    │   ├── ui/             # shadcn primitives
    │   └── markdown/
    ├── features/
    │   ├── agent/          # turn runner, agent state, observation formatting
    │   ├── chat/           # composer, messages, tool-group popover, slash commands
    │   └── workspace/      # apps registry, tabs, nav rail, settings panels
    ├── pages/              # auth/, chat/, onboarding/
    ├── hooks/
    ├── lib/                # theme, palette, http (CSRF), pdf.js setup
    ├── services/           # one API client per app, plus LLM helpers
    ├── types/              # one module per app
    ├── assets/
    └── styles/
        ├── globals.css
        └── themes/         # 8 files: default, dark, blue-*, fsu-*, pulse-*
```

App-specific UI lives under `utils/apps/{app_name}/frontend/` and is imported
through Vite path aliases (`@calendar`, `@mailbox`, …) declared in
`vite.config.ts` and `tsconfig.json`.

## Stack

React 19, TypeScript, Vite 7, TanStack Router, TanStack Query, Zustand, Tailwind
v4, shadcn/ui, Radix UI, Framer Motion, Vitest.

No form, validation, charting, or command-palette library is installed.

## Rules

- Routes are defined in `web/src/app/router.tsx`. There are five, and apps are
  tabs rather than routes — do not add a top-level route for a feature.
- Shared chrome belongs in `web/src/app/layouts/`.
- Reusable UI elements belong in `web/src/components/ui/` (shadcn).
- Feature modules belong in `web/src/features/`.
- Page compositions belong in `web/src/pages/`.
- API calls belong in `web/src/services/`, using `web/src/lib/http.ts` so the
  CSRF header is attached. No business logic beyond request/response handling.
- App-specific components belong in `utils/apps/{app}/frontend/` unless they are
  shared across the shell.
- Theme tokens live in `web/src/styles/themes/`, swapped via `data-theme` by
  `web/src/lib/theme.ts`. Every theme must satisfy the token contract in
  `web/src/lib/themeMeta.ts`, which `themeContract.test.ts` enforces.
- Do not call a backend endpoint before `docs/api.md` defines it.
