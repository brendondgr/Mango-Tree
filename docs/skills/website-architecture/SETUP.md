# Website Architecture Setup

A React/Vite SPA under `web/`, fully built and wired to the backend.

## Decisions

- Application type: React 19 / Vite 7 SPA with TanStack Router and Query.
- Styling: Tailwind v4, shadcn/ui, eight swappable themes across four families.
- Package manager: npm.
- Auth: implemented — single-owner session cookie, `AuthGate` on protected
  routes, CSRF header on state-changing requests.
- Data: live DRF endpoints for auth and all eight apps. No placeholder data.
- API: contract in `docs/api.md`.
- Testing: Vitest with Testing Library, `*.test.ts(x)` beside the source.
- Deployment: local development.

## Ports

Vite runs on **5173** and proxies `/api` to Django on **32553** with
`changeOrigin: false` — the Host header must survive for Django's CSRF origin
check. `/v1` and `/tokenize` proxy to the LLM server on **9090**.

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

Or start Django and Vite together from the repo root:

```bash
./scripts/server
```

## Required Docs

Keep `docs/platform.md` (routes, component map, workspace behaviour) and
`docs/api.md` (endpoints) synchronized with frontend changes.
