# API

Django REST Framework surface consumed by the `web/` frontend.

## Subdirectories

| Directory | Role |
| --- | --- |
| `routes/` | URL routing aggregating app endpoints |
| `serializers/` | Shared and cross-app serializers |
| `middleware/` | Auth, permission, and request middleware |
| `schemas/` | Request/response validation schemas |

Views should be thin: validate input, call app services, serialize output. Domain logic belongs in `utils/apps/{app}/backend/services/`.

See `docs/api-contract.md` and `docs/skills/django-backend/`.
