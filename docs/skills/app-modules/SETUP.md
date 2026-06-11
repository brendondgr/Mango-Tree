# App Modules Setup

## Decisions

- App root: `utils/apps/{app_name}/`.
- Standard subfolders: `backend/`, `frontend/`, `agent/`, `shared/`.
- Shared cross-app code: `utils/shared/`.
- API aggregation: `api/routes/`.

## Validation

```bash
uv run pytest tests/utils/apps/{app_name}/
uv run manage.py test
```

## Required Per-App Docs

Each app README should state:

- Purpose of the app.
- Subfolder layout.
- Registered API endpoints (link to `docs/api-contract.md`).
- Registered agent tools.
