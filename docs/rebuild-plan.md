# Mango Repository Rebuild Plan

## Goal

Rebuild Mango into a clean, AI-native monorepo with:

- a new frontend in `web/`
- all existing backend code preserved
- rebuilt dynamic applications under `utils/apps/{app_name}`
- a unified agent-driven interface
- no reliance on the old frontend implementation

The objective is to make the repository easier to navigate, easier to extend, and better suited for an AI-first product model.

---

## Core Direction

Mango should move from a mixed frontend layout into a single structured platform:

- **Backend remains intact**
- **Frontend is rebuilt from scratch**
- **Flask apps are reorganized into the integrated architecture**
- **Apps expose data and capabilities through APIs and services**
- **The agent layer becomes the main orchestration surface**

The frontend should not contain business logic. It should consume APIs.  
The agent should not depend on UI internals. It should consume tool interfaces.

---

## Recommended High-Level Repository Structure

```text
Mango/
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── router/
│       │   ├── providers/
│       │   ├── layouts/
│       │   └── stores/
│       ├── components/
│       │   ├── ui/
│       │   ├── forms/
│       │   ├── tables/
│       │   ├── charts/
│       │   └── markdown/
│       ├── features/
│       │   ├── chat/
│       │   ├── dashboard/
│       │   ├── command-palette/
│       │   ├── memory/
│       │   └── settings/
│       ├── pages/
│       │   ├── dashboard/
│       │   ├── projects/
│       │   ├── notes/
│       │   ├── jobs/
│       │   └── calendar/
│       ├── hooks/
│       ├── lib/
│       ├── services/
│       ├── types/
│       └── styles/
│
├── agents/
│   ├── coordinator/
│   ├── planner/
│   ├── memory/
│   ├── tools/
│   └── providers/
│
├── utils/
│   ├── apps/
│   │   ├── projects/
│   │   │   ├── backend/
│   │   │   ├── frontend/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   └── agent/
│   │   ├── notes/
│   │   ├── jobs/
│   │   ├── calendar/
│   │   ├── recipes/
│   │   ├── imdbspy/
│   │   ├── exercise/
│   │   └── timekeeper/
│   └── shared/
│       ├── auth/
│       ├── permissions/
│       ├── storage/
│       ├── search/
│       ├── embeddings/
│       └── events/
│
├── api/
│   ├── routes/
│   ├── serializers/
│   ├── middleware/
│   └── schemas/
│
├── config/
├── docs/
├── tests/
├── scripts/
└── requirements/
```

---

## Frontend Tech Stack

### Core

- **React**
- **TypeScript**
- **Vite**

Purpose:
- build a single-page application shell
- support highly dynamic views
- keep development fast
- make the UI easy to refactor

### Routing and Data

- **TanStack Router**
- **TanStack Query**
- **Zustand**

Purpose:
- route-based modularity
- server-state caching
- lightweight UI state management

### UI and Styling

- **Tailwind CSS**
- **shadcn/ui**
- **Radix UI**
- **Framer Motion**

Purpose:
- fast UI composition
- accessible primitives
- consistent design system
- fluid transitions and interactions

### Forms, Validation, and Content

- **React Hook Form**
- **Zod**
- **react-markdown**
- **remark-gfm**
- **rehype-highlight**

Purpose:
- structured forms
- runtime validation
- markdown rendering for notes and agent output
- readable rich text content

### Visualization and Interaction

- **Recharts**
- **cmdk**

Purpose:
- analytics and dashboards
- command palette and agent-first navigation

---

## Backend Stack

### Core Platform

- **Django**
- **Django REST Framework**
- **ASGI / Uvicorn**

Purpose:
- keep the backend stable
- preserve existing backend files
- expose consistent APIs
- support async workloads where needed

### Agent and Workflow Layer

- **LangGraph**

Purpose:
- coordinator and specialist agent flows
- multi-step reasoning
- tool execution planning
- branching workflows

### Async Processing

- **Celery**
- **Redis**

Purpose:
- background tasks
- long-running jobs
- queued agent actions
- scheduled processing
- event and cache support

### Data and Memory

- **PostgreSQL**
- **pgvector**

Purpose:
- primary relational store
- embeddings and memory retrieval
- app state and activity history

### Model Runtime

- **Llama-CPP**
- provider abstraction for cloud models

Purpose:
- local model inference
- optional cloud model fallback
- unified model access layer

### Storage

- **S3-compatible object storage**

Purpose:
- file uploads
- generated assets
- exports
- app attachments

---

## App Organization Standard

Each app should live under:

```text
utils/apps/{app_name}
```

Every app should follow a similar internal layout:

```text
utils/apps/{app_name}/
├── backend/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── tasks/
├── frontend/
│   ├── components/
│   ├── pages/
│   └── hooks/
├── agent/
│   ├── tools.py
│   └── prompts.py
└── shared/
    └── domain logic used by both API and agent layers
```

### Why this structure works

- the app's business logic lives in one place
- the frontend becomes a consumer, not the owner, of logic
- the agent can call the same tool layer as the UI
- Flask-based apps can be migrated without losing functionality

---

## Flask Migration Strategy

For any app currently implemented with Flask:

### Keep
- data models
- business rules
- services
- background jobs
- utilities
- API logic

### Remove from the old frontend path
- templates tied to the old UI
- static frontend files
- page-specific frontend routing
- duplicated client-side logic

### Reorganize into the new structure

```text
utils/apps/{app_name}/
├── backend/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── tasks/
├── frontend/
└── agent/
```

This preserves the app's functionality while making it first-class inside Mango.

---

## Recommended Responsibilities by Layer

### `web/`
Contains the full modern frontend application.

Responsibilities:
- dashboard shell
- app navigation
- AI chat workspace
- command palette
- settings panels
- app rendering

### `api/`
Contains the API surface that the frontend uses.

Responsibilities:
- route definitions
- serializers or schemas
- request validation
- middleware integration
- app-facing endpoints

### `agents/`
Contains the AI orchestration system.

Responsibilities:
- agent planning
- tool routing
- memory access
- provider selection
- multi-step workflows

### `utils/apps/`
Contains all app-specific implementation.

Responsibilities:
- domain logic
- data access
- services
- API behavior
- agent tools

### `utils/shared/`
Contains reusable foundations.

Responsibilities:
- auth
- permissions
- storage
- search
- embeddings
- event utilities

---

## Files and Folders to Remove or Retire

The frontend rewrite should retire old frontend-specific files and folders that are no longer part of the new UI architecture.

Keep backend code.  
Remove or replace frontend-specific assets, templates, scripts, and routing layers that belong only to the old implementation.

The exact cleanup should be done carefully, app by app, after confirming where the last frontend dependency lives.

---

## Recommended Build Sequence

### Phase 1
Create the new `web/` application shell.

### Phase 2
Define app boundaries under `utils/apps/{app_name}`.

### Phase 3
Build the shared API and tool interfaces.

### Phase 4
Migrate one app at a time from the old frontend shape into the new structure.

### Phase 5
Connect the agent layer to the same app tools used by the UI.

### Phase 6
Delete the old frontend artifacts after replacement is complete.

---

## Final Target State

```text
Mango
├── web/                 # new frontend
├── api/                 # API layer
├── agents/              # orchestration and tools
├── utils/apps/          # rebuilt app modules
├── utils/shared/        # shared foundations
├── config/              # project configuration
├── docs/                # architecture and plans
├── tests/               # automated tests
└── scripts/             # utility scripts
```

The result should be a clean repository where:
- the backend is preserved
- the frontend is modernized
- each app is easy to find
- agent integration is native
- future development stays organized
