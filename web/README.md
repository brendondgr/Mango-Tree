# Web Frontend

React/Vite SPA for the Mango Tree control surface.

## Stack

- React, TypeScript, Vite
- TanStack Router, TanStack Query, Zustand
- Tailwind CSS, shadcn/ui, Radix UI, Framer Motion
- Swappable theme via `data-theme` (Canva-inspired default)

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Dev server: http://localhost:5173

## Layout

```text
web/src/
├── app/          # router, providers, layouts, stores
├── components/   # shadcn ui primitives
├── features/     # chat, workspace
├── pages/        # route pages
├── hooks/
├── lib/
└── styles/       # theme CSS variables
```

The `/chat` route renders `AgentWorkspaceLayout` with `ChatWindow`, `WorkspaceHeader`, and `WorkspaceMainBody`.

See `docs/skills/website-architecture/` and `docs/skills/ui-frontend/` for conventions.
