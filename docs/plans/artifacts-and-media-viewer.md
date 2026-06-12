# Plan: Local Artifacts, Chat Nav Rail, and Media Viewer App

## Summary

Introduce a gitignored local artifact store under `data/artifacts/`, a thin left navigation rail on the `/chat` workspace that switches the existing resizable left sidebar between **Chat** and **Artifacts**, and scaffold **`media_viewer`** as the platform’s first fully implemented app module. The app owns artifact persistence, manifest management, media rendering (image carousel, video player, PDF, markdown, LaTeX, plain text), in-panel preview with a properties sidebar, and delete-with-confirmation — all backed by DRF services and matching agent tools.

## Layers Affected

| Layer | Scope |
| --- | --- |
| `data/` (new, gitignored) | Local artifact files, manifest, generated thumbnails |
| `config/` | Artifact root path, size limits, allowed MIME types |
| `utils/shared/` | Filesystem scope helpers, optional local-file storage adapter |
| `utils/apps/media_viewer/` | **New app** — services, API views, agent tools, UI fragments |
| `api/` | Route registration, serializers/schemas for media viewer endpoints |
| `agents/` | Tool registration in `config/tools.yaml` (when present) |
| `web/` | Chat nav rail, sidebar mode switching, workspace viewer shell, API clients |
| `docs/` | `platform.md`, `api.md`, app README |
| `tests/` | Service, API, permission denial, and frontend smoke tests |

---

## Current State (Baseline)

Understanding what exists today prevents rework:

- **`/chat`** uses `AgentWorkspaceLayout`: resizable left `ChatWindow` + right `WorkspaceHeader` / `WorkspaceMainBody` placeholder tabs (`overview`, `assets`, `history`).
- **Chat attachments** are processed client-side in `web/src/features/chat/utils/processAttachment.ts` with kinds `image | video | text | pdf`. Files live only in memory / Zustand message state — nothing is persisted locally or on the server.
- **Rendering primitives** already exist: `pdfjs-dist`, `react-markdown`, `katex` / `rehype-katex` (`web/src/components/markdown/MarkdownContent.tsx`), `MessageImageLightbox` for image carousel patterns.
- **Registered apps** under `utils/apps/` are README scaffolds only; no app has a full backend + frontend + agent implementation yet. **`media_viewer` will be the first.**
- **API** is contract-only (`docs/api.md`); DRF routes are not implemented. Plan must define endpoints before UI depends on them.
- **`.gitignore`** ignores `conversations/` but not `data/` yet.

---

## Target UX

### Layout (desktop)

```text
┌────┬──────────────────────────┬─────────────────────────────────────────────┐
│Nav │  Left sidebar (existing   │  Right workspace (existing main column)     │
│rail│  width, resize, collapse) │                                             │
│    │                           │  ┌─────────────────────┬──────────────────┐ │
│ 💬 │  Mode = Chat:             │  │  Media viewer       │  Properties      │ │
│ 📁 │    ChatWindow (unchanged) │  │  (image / video /   │  panel           │ │
│    │  Mode = Artifacts:        │  │   pdf / text / md)  │  (metadata,      │ │
│    │    artifact grid/list     │  └─────────────────────┴──────────────────┘ │
│    │    + delete confirm       │                                             │
└────┴──────────────────────────┴─────────────────────────────────────────────┘
```

### Nav rail behavior

- Fixed **thin rail** (~48–56px), always visible on `/chat`, sits **left of** the existing resizable sidebar.
- Two destinations only (v1): **Chat** and **Artifacts**.
- Selecting a destination swaps **left sidebar content** only; right workspace retains its own state.
- Mobile: rail collapses into the existing mobile drawer header or becomes a compact icon row above sidebar content — rail must not steal horizontal space needed for chat.

### Artifacts sidebar (left, when Artifacts selected)

- Chronological list/grid of artifacts (newest first by `created_at`).
- Each tile shows:
  - **Thumbnail**: real image for images; poster frame for videos with a **play-badge overlay**; extension/type icon for text, markdown, LaTeX, PDF, and unknown types.
  - **Name** (truncated), **kind badge**, **size**, **created date**.
- Clicking an artifact opens the **viewer in the right workspace** (not a separate route in v1).
- **Delete**: inline two-step confirmation inside the artifacts panel (select → “Delete?” → confirm/cancel). Use shadcn `AlertDialog` per `docs/skills/ui-frontend/ui/modals.md`. Never delete on first click.

### Viewer (right workspace)

- Replaces `WorkspaceMainBody` placeholder when an artifact is selected.
- **Split layout**: primary media canvas (left/flex-1) + **properties panel** (right, ~280–320px, collapsible on narrow screens).
- **Image**: full viewer with prev/next through **all image artifacts** in chronological order; keyboard arrows; metadata in properties panel.
- **Video**: HTML5 `<video>` with standard controls (play/pause, seek, volume, fullscreen, playback rate in v1 if low-cost).
- **PDF**: `pdfjs-dist` page renderer with page navigation.
- **Markdown** (`.md`): `MarkdownContent` renderer.
- **LaTeX** (`.tex`): treat as markdown/math document via `remark-math` + `rehype-katex`; full `.tex` preamble compilation is **out of scope** for v1 — render body math/markdown content, document in assumptions.
- **Plain text / code**: monospace preview with language label from extension.
- **Properties panel** fields: id, original filename, mime type, kind, size (human-readable), created_at, source (`chat_upload` | `agent` | `manual`), optional `chat_session_id` / `message_id`, dimensions (images/video), duration (video), page count (PDF), SHA-256 checksum.

### Chat → artifact persistence

- When a user attaches files in `ChatComposer` and sends a message, each successfully processed attachment is **also persisted** as an artifact (async, non-blocking to streaming).
- Persisted artifacts appear in the Artifacts sidebar without requiring the user to re-upload.
- Chat message `ChatAttachment` gains optional `artifactId` linking to the saved record.

---

## Local Storage Contract

### Directory layout

```text
data/                          # gitignored root for all local runtime data
└── artifacts/
    ├── manifest.json          # authoritative index (see schema below)
    ├── storage/               # raw uploaded bytes
    │   └── {artifact_id}{ext} # e.g. a1b2c3....pdf
    └── thumbnails/            # generated previews (optional for text-only)
        └── {artifact_id}.webp
```

### `manifest.json` schema (v1)

```json
{
  "version": 1,
  "updated_at": "2026-06-11T12:00:00Z",
  "artifacts": [
    {
      "id": "uuid",
      "filename": "diagram.png",
      "storage_path": "storage/uuid.png",
      "thumbnail_path": "thumbnails/uuid.webp",
      "mime_type": "image/png",
      "kind": "image",
      "size_bytes": 1048576,
      "created_at": "2026-06-11T11:58:00Z",
      "source": "chat_upload",
      "source_chat_session_id": "uuid-or-null",
      "source_message_id": "uuid-or-null",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "duration_seconds": null,
        "page_count": null,
        "language": null,
        "checksum_sha256": "hex"
      }
    }
  ]
}
```

### Kind taxonomy (extend chat attachment kinds)

| `kind` | Detection | Thumbnail strategy |
| --- | --- | --- |
| `image` | mime `image/*` | Resize/copy to `thumbnails/` |
| `video` | mime `video/*` | Extract poster frame server-side (or accept client-provided poster on upload) + play overlay in UI |
| `pdf` | mime/pdf or `.pdf` | PDF icon tile; optional first-page raster in later phase |
| `markdown` | `.md` | Markdown file icon |
| `latex` | `.tex` | LaTeX icon |
| `text` | `text/*` or known code extensions | Extension-based icon (reuse `fileType.ts` mapping) |
| `unknown` | fallback | Generic file icon |

### Git safety

Add to `.gitignore`:

```gitignore
# Local runtime data (artifacts, future datasets)
data/
```

Add `data/.gitkeep` is **not** required — the backend creates directories on first write. Document the path in `docs/platform.md`.

### Config

Add to `config/` (new `artifacts.yaml` or section in Django settings):

```yaml
artifacts:
  root: data/artifacts          # relative to repo root or absolute path
  max_file_size_bytes: 20971520 # align with chat MAX_FILE_SIZE
  max_image_size_bytes: 5242880
  max_pdf_size_bytes: 10485760
  allowed_kinds: [image, video, pdf, markdown, latex, text]
```

Resolve root via environment override `MANGO_ARTIFACTS_ROOT` for deployments.

---

## App Module: `media_viewer`

First real app under `utils/apps/media_viewer/`. Follow `docs/skills/app-modules/SKILL.md` layout exactly.

```text
utils/apps/media_viewer/
├── README.md
├── backend/
│   ├── api/
│   │   ├── views.py
│   │   └── serializers.py
│   ├── models/                 # optional v1 — manifest is source of truth
│   ├── services/
│   │   ├── manifest.py         # read/write manifest.json atomically
│   │   ├── artifact_store.py   # save, delete, stream bytes
│   │   ├── thumbnails.py       # image resize, video poster extraction
│   │   └── classification.py   # mime/kind detection (mirror chat rules)
│   └── tasks/
│       └── generate_thumbnail.py  # Celery for heavy video/pdf work
├── frontend/
│   ├── components/
│   │   ├── ArtifactGrid.tsx
│   │   ├── ArtifactTile.tsx
│   │   ├── ArtifactDeleteDialog.tsx
│   │   ├── MediaViewerShell.tsx
│   │   ├── viewers/
│   │   │   ├── ImageViewer.tsx
│   │   │   ├── VideoViewer.tsx
│   │   │   ├── PdfViewer.tsx
│   │   │   ├── MarkdownViewer.tsx
│   │   │   ├── LatexViewer.tsx
│   │   │   └── TextViewer.tsx
│   │   └── ArtifactPropertiesPanel.tsx
│   ├── hooks/
│   │   ├── useArtifacts.ts
│   │   └── useArtifactViewer.ts
│   └── pages/
│       └── ArtifactsSidebar.tsx
├── agent/
│   ├── tools.py
│   └── prompts.py
└── shared/
    ├── schemas.py              # Pydantic/dataclass artifact DTOs
    └── constants.py
```

### Service design principles

- **`manifest.py`**: single writer — use atomic replace (`write temp → os.replace`) to avoid corrupt JSON under concurrent uploads.
- **`artifact_store.py`**: all filesystem paths resolved under `artifacts.root`; reject path traversal (`..`, absolute paths).
- **No business logic in DRF views or agent tools** — views/tools call services only.
- **Deletion**: remove storage file, thumbnail, and manifest entry in one service transaction; if file delete fails, roll back manifest change and return `conflict` error.
- **Streaming**: `GET .../content/` returns `FileResponse` with correct `Content-Type` and `Content-Disposition: inline` for viewer, `attachment` for download.

### Django registration

- Register `utils.apps.media_viewer.backend` as a Django app in `config/django/settings`.
- Mount routes under `api/routes/media_viewer.py` → include in root URLconf.

---

## API / Schema Changes

Document all endpoints in `docs/api.md` **before** frontend implementation.

### Media Viewer / Artifacts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/media-viewer/artifacts/` | List artifacts (paginated, default 25, sort `-created_at`) |
| `POST` | `/api/media-viewer/artifacts/` | Upload + register artifact (`multipart/form-data`) |
| `GET` | `/api/media-viewer/artifacts/{id}/` | Artifact metadata |
| `DELETE` | `/api/media-viewer/artifacts/{id}/` | Delete artifact + files |
| `GET` | `/api/media-viewer/artifacts/{id}/content/` | Stream raw bytes |
| `GET` | `/api/media-viewer/artifacts/{id}/thumbnail/` | Stream thumbnail (404 → UI falls back to kind icon) |

#### `POST /api/media-viewer/artifacts/` body (multipart)

| Field | Required | Notes |
| --- | --- | --- |
| `file` | yes | Raw bytes |
| `source` | no | default `manual`; chat integration sends `chat_upload` |
| `source_chat_session_id` | no | UUID string |
| `source_message_id` | no | UUID string |
| `poster` | no | Optional image for video poster (client-extracted frame) |

#### List response shape

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [ { /* artifact metadata */ } ]
}
```

#### Error codes

Use stable API codes: `validation_error`, `permission_denied`, `not_found`, `conflict`, `internal_error`.

---

## Agent Tool Changes

Register in `utils/apps/media_viewer/agent/tools.py` and `config/tools.yaml`.

| Tool | Input | Output | Service |
| --- | --- | --- | --- |
| `media_viewer_list_artifacts` | `{ kind?: string, limit?: int }` | `{ artifacts: [...] }` | `artifact_store.list` |
| `media_viewer_get_artifact` | `{ artifact_id: string }` | `{ artifact: {...} }` | `artifact_store.get` |
| `media_viewer_save_artifact` | `{ path or bytes ref, filename, source }` | `{ artifact_id, ... }` | `artifact_store.save` |
| `media_viewer_delete_artifact` | `{ artifact_id: string, confirm: true }` | `{ deleted: true }` | `artifact_store.delete` |

### Permission scopes

- Filesystem scope: **read/write only** under `{artifacts.root}/**`.
- Deny reads/writes outside artifact root (including repo source, `.env`, `config/`).
- `confirm: true` required for delete tool — matches UI two-step confirmation semantics.
- Tools return structured JSON for coordinator validation.

### Prompts (`agent/prompts.py`)

Short system fragment: when to persist uploads, how to reference `artifact_id` in replies, and that deletion requires explicit user confirmation.

---

## Frontend Changes

### New / modified locations

| Area | Path | Change |
| --- | --- | --- |
| Nav rail | `web/src/features/workspace/components/ChatNavRail.tsx` | New thin icon rail |
| Sidebar mode | `web/src/app/stores/workspaceStore.ts` | Add `sidebarMode: 'chat' \| 'artifacts'` |
| Layout | `web/src/app/layouts/AgentWorkspaceLayout.tsx` | Compose rail + conditional sidebar |
| Chat sidebar | `web/src/features/chat/components/ChatWindow.tsx` | Extract shell; render only in `chat` mode |
| Artifacts sidebar | `utils/apps/media_viewer/frontend/pages/ArtifactsSidebar.tsx` | Grid/list + delete |
| Viewer | `utils/apps/media_viewer/frontend/components/MediaViewerShell.tsx` | Right workspace content |
| API client | `web/src/services/mediaViewerClient.ts` | Thin fetch wrappers only |
| Types | `web/src/types/mediaViewer.ts` or app shared export | Mirror API schema |
| Queries | TanStack Query hooks in app `frontend/hooks/` | `useArtifacts`, `useArtifact` |

### State model

```typescript
// workspaceStore additions
sidebarMode: 'chat' | 'artifacts';
selectedArtifactId: string | null;
setSidebarMode(mode): void;
setSelectedArtifactId(id | null): void;
```

- Selecting an artifact sets `selectedArtifactId` and ensures right panel shows `MediaViewerShell`.
- Switching sidebar mode to Chat does **not** clear `selectedArtifactId` (user can return to viewer via re-select or a “open in viewer” affordance on right panel — v1: keep viewer visible until explicitly closed with an X on viewer chrome).

### Reuse from chat feature

| Existing | Reuse in media_viewer |
| --- | --- |
| `fileType.ts` | Share via `utils/apps/media_viewer/frontend` or extract to `web/src/lib/fileType.ts` to avoid duplication |
| `processAttachment.ts` | Chat keeps client preview; on send, POST file to artifact API |
| `MessageImageLightbox.tsx` | Reference for `ImageViewer` carousel keyboard handling |
| `MarkdownContent.tsx` | Import directly for markdown/LaTeX viewers |

### Right workspace integration

Replace `WorkspaceMainBody` placeholder when `selectedArtifactId` is set:

```tsx
// WorkspaceMainBody.tsx (conceptual)
if (selectedArtifactId) return <MediaViewerShell artifactId={selectedArtifactId} />;
// else existing tab placeholder
```

Wire `WorkspaceHeader` “Assets” tab to `setSidebarMode('artifacts')` in a later polish phase — **not required for v1** since nav rail is the primary switcher.

### Thumbnail UI differentiation

- **Video**: thumbnail image + centered play icon (Lucide `Play` in semi-transparent circle) + small “Video” badge.
- **Image**: bare thumbnail.
- **PDF / text / md / tex**: colored tile with extension label (e.g. `PDF`, `MD`, `TEX`, `PY`).

### Dependencies

No new npm packages required for v1 — `pdfjs-dist`, `react-markdown`, `katex` already installed. Video uses native `<video>`.

---

## Implementation Phases

Each phase is one logical unit: implement → validate → commit (per global skill). Dependencies flow top to bottom.

### Phase 0 — Documentation and contracts

**Goal:** Decision-complete contracts before code.

1. Add this plan file (done).
2. Update `docs/api.md` with media-viewer endpoints.
3. Update `docs/platform.md`:
   - `data/artifacts/` local store
   - `/chat` layout diagram with nav rail
   - Register `media_viewer` in app list
4. Add `utils/apps/media_viewer/README.md` stub pointing to endpoints and tools.

**Acceptance:** Docs describe routes, data layout, and permission boundaries; no undocumented endpoints.

**Validate:** Manual review of docs cross-links.

---

### Phase 1 — Local data foundation

**Goal:** Gitignored storage exists; manifest schema validated in tests.

1. Add `data/` to `.gitignore`.
2. Add `config/artifacts.yaml` + Django settings loader.
3. Implement `utils/apps/media_viewer/shared/schemas.py` (ArtifactRecord, Manifest).
4. Implement `backend/services/manifest.py` and `classification.py`.
5. Implement `backend/services/artifact_store.py` (save, get, list, delete) — filesystem only, no HTTP yet.

**Acceptance:**

- `save` writes bytes + manifest entry atomically.
- `delete` removes all three paths (storage, thumbnail, manifest).
- Path traversal attempts raise permission/validation error.

**Validate:**

```bash
uv run pytest tests/utils/apps/media_viewer/test_artifact_store.py -q
```

---

### Phase 2 — API surface

**Goal:** UI can list/upload/delete/stream via HTTP.

1. DRF serializers + views in `backend/api/`.
2. Register `api/routes/media_viewer.py`.
3. Wire multipart upload + `FileResponse` streaming.
4. Implement `backend/services/thumbnails.py` (image resize; stub video poster if Celery not ready).

**Acceptance:**

- `curl` list/upload/get/delete/content round-trip works.
- Pagination matches platform default (25).
- Errors return stable JSON codes.

**Validate:**

```bash
uv run pytest tests/api/test_media_viewer.py -q
```

---

### Phase 3 — Chat nav rail + sidebar mode switching

**Goal:** User can switch between Chat and Artifacts sidebars.

1. Add `ChatNavRail` component.
2. Extend `workspaceStore` with `sidebarMode`.
3. Update `AgentWorkspaceLayout` to render rail + conditional sidebar.
4. Scaffold `ArtifactsSidebar` with empty state (“No artifacts yet”).

**Acceptance:**

- Rail toggles sidebar content without breaking resize/collapse/mobile drawer.
- Chat mode is pixel-identical to current behavior.

**Validate:**

```bash
cd web && npm run build
```

Manual: resize sidebar, mobile breakpoint, theme toggle still work.

---

### Phase 4 — Artifacts list UI

**Goal:** Grid/list with thumbnails, metadata, delete confirmation.

1. `useArtifacts` TanStack Query hook + `mediaViewerClient.ts`.
2. `ArtifactTile`, `ArtifactGrid`, `ArtifactDeleteDialog`.
3. Thumbnail URL: `/api/media-viewer/artifacts/{id}/thumbnail/` with icon fallback.
4. Two-step delete calls `DELETE` API and invalidates query cache.

**Acceptance:**

- Upload via API appears in grid sorted newest-first.
- Delete requires confirm; canceled delete leaves artifact intact.
- Video tiles show play overlay.

**Validate:** Manual upload + delete; `npm run build`.

---

### Phase 5 — Media viewer (right workspace)

**Goal:** Full in-panel viewer with properties sidebar.

1. `MediaViewerShell` + per-kind viewers.
2. `ArtifactPropertiesPanel`.
3. Image carousel scopes navigation to artifacts where `kind === 'image'`.
4. PDF page controls; markdown/LaTeX via `MarkdownContent`; text/code monospace view.
5. Close button clears `selectedArtifactId`.

**Acceptance:**

- Click artifact → viewer opens in right column, not a modal.
- Properties show accurate metadata from API.
- Image prev/next walks chronological image artifacts.

**Validate:** Manual per-kind smoke test; `npm run build`.

---

### Phase 6 — Chat upload persistence

**Goal:** Attachments sent in chat become artifacts automatically.

1. After successful `processAttachment` + message send, `POST` each file to artifact API with `source=chat_upload` and session/message ids.
2. Extend `ChatAttachment` with optional `artifactId`.
3. Show subtle “Saved to artifacts” indicator on message attachments (optional chip).

**Acceptance:**

- Send image in chat → appears in Artifacts sidebar without manual upload.
- Failed persistence does not block chat stream (log + toast warning).

**Validate:** Manual chat send + artifacts list check.

---

### Phase 7 — Agent tools + permissions

**Goal:** Agents can list/read/save/delete artifacts with same enforcement as API.

1. Implement `agent/tools.py` calling services.
2. Register tools in `config/tools.yaml`.
3. Add filesystem permission entries in `config/permissions.yaml` (when created) scoping `data/artifacts/**`.
4. Emit trace events on save/delete (`utils/shared/events/`).

**Acceptance:**

- Tool save/list/delete mirrors API outcomes.
- Tool calling `delete` without `confirm: true` is denied.

**Validate:**

```bash
uv run pytest tests/utils/apps/media_viewer/test_agent_tools.py tests/agents/ -q
```

---

### Phase 8 — Hardening and polish

**Goal:** Production-quality edge cases.

1. Celery task for video poster + large PDF first-page thumbnail (if not done in Phase 2).
2. Concurrent upload stress test (manifest locking).
3. Empty/corrupt manifest recovery (bootstrap empty manifest).
4. Accessibility pass: rail `aria-label`, viewer keyboard traps, focus return on close.
5. Update `docs/skills/app-modules/SKILL.md` registered apps list to include `media_viewer`.

**Acceptance:** Denial tests pass; corrupt manifest auto-recovers; a11y spot-check passes.

---

## Test Plan

### Service tests (`tests/utils/apps/media_viewer/`)

| Test | Type |
| --- | --- |
| Save artifact writes storage + manifest | success |
| Save rejects path traversal filename | denial |
| Save rejects oversize file | denial |
| Save rejects disallowed mime/kind | denial |
| Delete removes all files + manifest entry | success |
| Delete missing id returns not found | success |
| Manifest atomic write under concurrent saves | success |
| List filters by kind | success |
| Classification matches chat `fileType` rules | success |

### API tests (`tests/api/test_media_viewer.py`)

| Test | Type |
| --- | --- |
| `GET /artifacts/` paginates | success |
| `POST /artifacts/` multipart upload | success |
| `GET /artifacts/{id}/content/` streams bytes | success |
| `DELETE` without auth/context (when auth lands) | denial |
| `DELETE` idempotent behavior documented | success |
| Invalid UUID → `not_found` | success |

### Agent tests (`tests/utils/apps/media_viewer/test_agent_tools.py`)

| Test | Type |
| --- | --- |
| `list_artifacts` returns structured output | success |
| `delete_artifact` without `confirm: true` | denial |
| `save_artifact` outside scoped root | denial |
| Tool uses service layer (mock service, not filesystem in tool test) | success |

### Frontend

- Component tests optional in v1; rely on `npm run build` + manual smoke.
- Storybook not required.

### Permission denial tests (mandatory)

Any tool or API touching filesystem must include **denial** cases: traversal, out-of-root paths, oversize payload, missing confirmation on delete.

---

## Migration Notes

- **Not a Flask migration** — greenfield app module.
- **Chat attachments:** backward compatible — existing in-memory attachments work; `artifactId` is optional.
- **Workspace tabs:** `assets` tab placeholder may later delegate to artifacts viewer; nav rail is canonical in v1.
- **S3:** `utils/shared/storage/` remains for future cloud-backed artifacts. v1 intentionally uses local `data/artifacts/` for simplicity and git safety. Document migration path: service interface abstracts `ArtifactBackend` (`local` now, `s3` later).
- **PostgreSQL:** optional Phase 9+ — index artifacts in DB for search while keeping files on disk. v1 manifest-only is acceptable for first app.

---

## Assumptions and Explicit Non-Goals (v1)

### Assumptions

- Single-user local instance (no multi-tenant artifact namespaces yet). All artifacts belong to the local Mango instance.
- Auth middleware may not be fully wired; permission checks still implemented in services so they activate when auth lands.
- LaTeX `.tex` files are rendered as markdown + math content, not compiled to PDF via `pdflatex`.
- Scanned PDFs (no extractable text) still view as rendered pages; chat text extraction limitations remain.
- Thumbnail generation for video may use client-provided poster on upload if server extraction is deferred.
- Chronological order uses `created_at` ISO timestamp in manifest.

### Non-goals (v1)

- Full-text search across artifacts.
- Agent-initiated bulk export/sync to GitHub or cloud.
- Editing/saving modified document content back to disk.
- Version history per artifact (only single latest blob).
- Dedicated `/artifacts` top-level route (viewer lives in `/chat` workspace).
- User-defined folders/tags/collections.

---

## Documentation Updates Checklist

| File | Update |
| --- | --- |
| `docs/api.md` | Media viewer endpoints |
| `docs/platform.md` | Layout, `data/artifacts`, app registration |
| `utils/apps/media_viewer/README.md` | Purpose, layout, endpoints, tools |
| `docs/skills/app-modules/SKILL.md` | Add `media_viewer` to registered apps list |
| `.gitignore` | `data/` |
| `config/artifacts.yaml` | New |
| `config/tools.yaml` | Register media_viewer tools (when file exists) |

---

## Validation Commands (per phase)

```bash
# Backend services + API
uv run pytest tests/utils/apps/media_viewer/ -q
uv run pytest tests/api/test_media_viewer.py -q

# Agents
uv run pytest tests/utils/apps/media_viewer/test_agent_tools.py -q

# Frontend
cd web && npm run build

# Full suite (before merge)
uv run pytest
cd web && npm run build
```

---

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Manifest corruption on crash mid-write | Atomic `os.replace`; load-time validation + backup |
| Large video blocking request thread | Accept client poster; offload to Celery task |
| Duplicated file type logic (chat vs backend) | Shared classification table in `media_viewer/shared` + Python port of `fileType.ts` rules |
| Horizontal space on small screens | Rail icons only; collapse properties panel below viewer |
| API not implemented yet | Phase 0 contracts + Phase 2 API before Phase 4 UI |
| Agent/API permission drift | Both call identical service methods; denial tests for each |

---

## Success Criteria (overall)

1. `data/artifacts/` stores user uploads locally and is **not** tracked by git.
2. Thin nav rail switches left sidebar between Chat and Artifacts.
3. Artifacts list shows differentiated thumbnails with delete confirmation in-panel.
4. Selecting an artifact opens a full media viewer with properties in the right workspace.
5. `media_viewer` is the first complete app under `utils/apps/` with backend services, API, agent tools, and frontend fragments.
6. Chat uploads are persisted as artifacts automatically.
7. Permission denial tests exist for filesystem scope and delete confirmation.
