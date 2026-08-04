# API

The Django REST Framework surface consumed by `web/` and by the app frontend
fragments under `utils/apps/{app}/frontend/`.

| Directory | State | Role |
| --- | --- | --- |
| `routes/` | implemented | One URLconf module per app, included by `config/django/urls.py` under `/api/` |
| `middleware/` | **empty placeholder** | No custom middleware; `settings.MIDDLEWARE` is stock Django |
| `serializers/` | **empty placeholder** | Serializers live with their app, in `utils/apps/{app}/backend/api/` |
| `schemas/` | **empty placeholder** | Request validation happens in the views and services |

Views stay thin — validate input, call an app service, serialize the result.
Domain logic belongs in `utils/apps/{app}/backend/services/`.

Authentication is project-wide: `IsAuthenticated` is the DRF default
(`config/django/settings.py`), so every endpoint requires a session cookie except
`/api/health/` and the public routes under `/api/auth/`.

See `docs/api.md` for the full endpoint contract.
