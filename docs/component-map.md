# Component Map

Frontend source lives in `web/src/`. App-specific fragments may also live in `utils/apps/{app}/frontend/`.

## Shell Components

| Area | Path | Purpose |
| --- | --- | --- |
| Router | `web/src/app/router/` | TanStack Router route definitions. |
| Providers | `web/src/app/providers/` | Query client, theme, auth providers. |
| Layouts | `web/src/app/layouts/` | App shell, sidebar, header, page chrome. |
| Stores | `web/src/app/stores/` | Zustand stores for UI state. |

## Shared Components

| Area | Path | Purpose |
| --- | --- | --- |
| UI primitives | `web/src/components/ui/` | shadcn/ui components (Button, Card, Dialog, etc.). |
| Forms | `web/src/components/forms/` | Form wrappers with React Hook Form and Zod. |
| Tables | `web/src/components/tables/` | Data tables with sorting and pagination. |
| Charts | `web/src/components/charts/` | Recharts wrappers with Mango theme. |
| Markdown | `web/src/components/markdown/` | react-markdown renderers for notes and agent output. |

## Feature Modules

| Feature | Path | Purpose |
| --- | --- | --- |
| Chat | `web/src/features/chat/` | AI chat workspace. |
| Dashboard | `web/src/features/dashboard/` | Stats, activity feed, quick actions. |
| Command palette | `web/src/features/command-palette/` | cmdk navigation and agent commands. |
| Memory | `web/src/features/memory/` | Namespace and dataset visibility. |
| Settings | `web/src/features/settings/` | Platform and app configuration. |

## Pages

| Page | Path | Purpose |
| --- | --- | --- |
| Dashboard | `web/src/pages/dashboard/` | Main landing view. |
| Projects | `web/src/pages/projects/` | Project list and detail. |
| Notes | `web/src/pages/notes/` | Notes list and editor. |
| Jobs | `web/src/pages/jobs/` | Job management. |
| Calendar | `web/src/pages/calendar/` | Calendar view. |

## Supporting Code

| Area | Path | Purpose |
| --- | --- | --- |
| Hooks | `web/src/hooks/` | Shared React hooks. |
| Lib | `web/src/lib/` | Utilities, cn helper, constants. |
| Services | `web/src/services/` | API client functions (no business logic). |
| Types | `web/src/types/` | TypeScript types matching API schemas. |
| Styles | `web/src/styles/` | Tailwind globals, Mango theme CSS variables. |

## App Fragments

App-specific components imported into the shell:

| App | Path | Purpose |
| --- | --- | --- |
| Projects | `utils/apps/projects/frontend/` | Project-specific UI. |
| Notes | `utils/apps/notes/frontend/` | Note editor and list components. |
| Jobs | `utils/apps/jobs/frontend/` | Job status and management UI. |
| Calendar | `utils/apps/calendar/frontend/` | Calendar widgets. |

## Legacy Note

The current `web/src/` directory contains Astro components (`*.astro`), UnoCSS config, and Pulse Light theme CSS. These will be replaced by the React/Vite structure above during Phase 1 of the rebuild.
