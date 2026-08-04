# Web Frontend

React/Vite SPA for the Mango Tree control surface.

## Stack

- React 19, TypeScript, Vite 7
- TanStack Router, TanStack Query, Zustand
- Tailwind CSS v4, shadcn/ui (new-york), Radix UI, Framer Motion
- Vitest + Testing Library
- Eight swappable themes via `data-theme` (default is Canva-inspired)

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

Dev server: http://localhost:5173. It proxies `/api` to Django on 32553
(`changeOrigin: false`, to preserve the Host header for CSRF) and `/v1` plus
`/tokenize` to the LLM server on 9090.

## Layout

```text
web/src/
├── app/          # router, providers, AuthGate, layouts, zustand stores
├── components/   # shadcn primitives, markdown rendering
├── features/     # agent (turn runner), chat, workspace
├── pages/        # auth, chat, onboarding
├── services/     # per-app API clients and LLM helpers
├── types/        # per-app response types
├── hooks/
├── lib/          # theme, palette, http, pdf.js setup
├── assets/
└── styles/       # globals.css + themes/*.css
```

## Routes

`/` redirects to `/chat`. `/login`, `/signup`, and `/onboarding` are the auth
flow; `/chat` is the application. That is the whole route tree — apps are not
routes, they are workspace tabs inside `/chat`.

`/chat` renders `AgentWorkspaceLayout` with `ChatWindow`, `WorkspaceHeader`, and
`WorkspaceMainBody`.

## Apps

`src/features/workspace/apps/appRegistry.tsx` is the single source of truth for
which apps appear as tabs. The eight registered apps import their pages from
`utils/apps/{app}/frontend/` through the Vite aliases in `vite.config.ts`, so
app UI lives with the app, not here.

## Themes

Four families, light and dark each: mango (`default` / `dark`), `blue-*`,
`fsu-*`, `pulse-*`. Every theme file must define the token contract in
`src/lib/themeMeta.ts`, which `src/lib/themeContract.test.ts` enforces.

See `docs/skills/website-architecture/` and `docs/skills/ui-frontend/` for conventions.
