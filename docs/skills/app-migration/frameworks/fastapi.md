# Migrating a FastAPI source app

Use this when Stage 0 detects FastAPI (`FastAPI()`, `APIRouter`, `@app.get/@app.post`,
`uvicorn`, Pydantic models, often SQLAlchemy or SQLModel + Alembic).

FastAPI apps are usually better-structured than Flask (Pydantic schemas, dependency
injection), which makes service extraction cleaner. The data-layer translation is the
same problem as Flask.

## Where each responsibility lives

| Responsibility | Typical FastAPI location | Target |
| --- | --- | --- |
| Data models | SQLAlchemy/SQLModel classes | `utils/apps/{name}/backend/models/` (translate) |
| Pydantic schemas | `schemas.py` request/response models | `shared/schemas.py` DTOs + DRF serializers |
| Business logic | `crud.py`, service modules, or inline in path ops | `backend/services/` (move/extract) |
| Dependencies (`Depends`) | `dependencies.py` | split: data access → services; auth → `utils/shared/auth` |
| HTTP routes | `APIRouter` path operations | `backend/api/` + `utils/api/routes/{name}.py` |
| Background jobs | `BackgroundTasks`, Celery, ARQ | `backend/tasks/` (Celery) |
| DB config | `database.py` engine/session | platform DB config (see DB preservation) |
| Migrations | Alembic `versions/` | basis for DB preservation |
| Auth | OAuth2/JWT dependencies | reconcile with `utils/shared/auth` + `permissions` |

## Notes

- **Pydantic does double duty.** Source Pydantic models often serve as both validation
  and serialization. On the target, validation/serialization is DRF's job at the API
  edge, while the same shapes become `shared/schemas.py` DTOs for services and tools.
  Reuse the field definitions; don't keep FastAPI imports in services.
- **`Depends` injection.** Database-session dependencies become explicit service
  arguments (and a session/store handle the agent tool can inject for testing). Auth
  dependencies move to `utils/shared/auth` + `permissions`.
- **`crud.py` is already most of a service layer** — moving it to `backend/services/`
  is usually low-friction; strip any FastAPI/`Session`-as-global coupling.
- **Async.** Source code may be `async def`. Django/DRF here is ASGI (Uvicorn), so
  async services are fine, but keep agent tools and Celery tasks consistent with how
  the rest of the platform calls services; prefer making the service the boundary and
  letting each caller adapt.
- **SQLAlchemy/SQLModel → Django models:** same preservation rules as Flask — see
  `flask.md` and `../database-preservation.md`. Match `__tablename__`, columns,
  nullability, defaults, and indexes exactly.

## Parity mapping

Each `APIRouter` path operation that performs a capability becomes a service function
exposed through both a DRF view and an `agent/tools.py` tool, same as the other
frameworks.
