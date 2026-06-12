# Media Viewer

First fully implemented Mango Tree app module. Owns local artifact persistence, manifest management, media rendering, and agent tools for the `/chat` workspace.

## Purpose

- Persist chat uploads and agent-generated files under `data/artifacts/` (gitignored).
- List artifacts in the left sidebar when **Artifacts** is selected on the chat nav rail.
- Open selected artifacts in the right workspace with kind-specific viewers and a properties panel.

## Layout

```text
utils/apps/media_viewer/
├── backend/
│   ├── api/           # DRF views and serializers
│   ├── services/      # manifest, artifact_store, thumbnails, classification
│   └── tasks/         # Celery thumbnail generation (optional)
├── frontend/
│   ├── components/    # viewers, grid, delete dialog
│   ├── hooks/         # TanStack Query hooks
│   └── pages/         # ArtifactsSidebar
├── agent/
│   ├── tools.py       # list, get, save, delete
│   └── prompts.py
└── shared/
    ├── schemas.py     # ArtifactRecord, Manifest DTOs
    └── constants.py
```

## HTTP API

Documented in `docs/api.md` under **Media Viewer (Artifacts)**:

| Method | Endpoint |
| --- | --- |
| `GET` | `/api/media-viewer/artifacts/` |
| `POST` | `/api/media-viewer/artifacts/` |
| `GET` | `/api/media-viewer/artifacts/{id}/` |
| `DELETE` | `/api/media-viewer/artifacts/{id}/` |
| `GET` | `/api/media-viewer/artifacts/{id}/content/` |
| `GET` | `/api/media-viewer/artifacts/{id}/thumbnail/` |

DRF routes: `api/routes/media_viewer.py`. Views call `backend/services/` only.

## Agent tools

Registered in `config/tools.yaml` when present:

| Tool | Service |
| --- | --- |
| `media_viewer_list_artifacts` | `artifact_store.list` |
| `media_viewer_get_artifact` | `artifact_store.get` |
| `media_viewer_save_artifact` | `artifact_store.save` |
| `media_viewer_delete_artifact` | `artifact_store.delete` (requires `confirm: true`) |

Filesystem scope: read/write only under `{artifacts.root}/**`. Deny path traversal and out-of-root access.

## Configuration

`config/artifacts.yaml` — root path, size limits, allowed kinds. Override root with `MANGO_ARTIFACTS_ROOT`.

## Frontend integration

Imported by `web/` via Vite alias `@media-viewer` → `utils/apps/media_viewer/frontend/`. API client: `web/src/services/mediaViewerClient.ts`.

Selecting an artifact opens an **ephemeral workspace tab** in `WorkspaceHeader` (not a separate route). Switching to Overview/Assets/History closes the tab; re-open from the Artifacts sidebar. Grid density is configurable (1–5 columns per row, default 4). The viewer uses a vertical split: media canvas on top, resizable scrollable properties panel at the bottom.
