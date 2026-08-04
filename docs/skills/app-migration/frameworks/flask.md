# Migrating a Flask source app

Use this when Stage 0 detects Flask (`Flask(__name__)`, `@app.route`, blueprints,
`flask run`, often SQLAlchemy + Alembic).

Flask gives little structure, so business logic is usually fused into route handlers.
The main work is **extracting services** and **translating the data layer** without
changing the data.

## Where each responsibility lives

| Responsibility | Typical Flask location | Target |
| --- | --- | --- |
| Data models | SQLAlchemy `db.Model` classes, often `models.py` | `utils/apps/{name}/backend/models/` (translate) |
| Schema migrations | Alembic `migrations/versions/` | basis for DB preservation (see below) |
| Business logic | inline in `@app.route` / blueprint handlers | `backend/services/` (extract) |
| HTTP routes | `@app.route`, `Blueprint` | `backend/api/` + `utils/api/routes/{name}.py` |
| Request/response schemas | Marshmallow / Pydantic / manual dicts | `shared/schemas.py` + DRF serializers |
| Background jobs | Celery, RQ, APScheduler | `backend/tasks/` |
| Validators / utils | `utils.py`, helpers | `shared/` |
| DB config | `SQLALCHEMY_DATABASE_URI` | platform DB config (see DB preservation) |
| Templates / static | Jinja `templates/`, `static/` | discard; rebuild as `frontend/` + tab |
| Auth | Flask-Login / JWT / sessions | reconcile with `utils/shared/auth` + `permissions` |

## The SQLAlchemy → Django models question

This is the crux of "keep the database the same." You are not free to let Django
recreate the schema, because the existing tables already hold data. Pick a strategy
from `../database-preservation.md`:

- **Bind to existing (recommended default):** write Django models whose `Meta.db_table`
  equals the SQLAlchemy `__tablename__` and whose fields map column-for-column, with
  `managed = False` so Django never alters the tables. The data is untouched; Django
  just reads/writes the existing rows.
- **Inspect and adopt:** point Django's `DATABASES` at the legacy DB and run
  `uv run manage.py inspectdb` to generate models from the live schema, then curate.
- **Migrate with data:** only if the app should own a Django-managed SQLite database
  with real migrations (as imdbspy does); recreate via Django migrations and move
  rows with a verified ETL.

Map SQLAlchemy column types to Django fields carefully (e.g. `db.String(n)` →
`CharField(max_length=n)`, `db.Text` → `TextField`, `db.Integer` → `IntegerField`,
`db.DateTime` → `DateTimeField`, relationship FKs → `ForeignKey(..., db_column=...)`).
Preserve nullability, defaults, uniqueness, and indexes exactly.

## Extraction notes

- **Every route handler is a suspect.** Assume each `@app.route` body mixes parsing,
  validation, domain logic, and persistence. Split it: parsing/serialization → DRF
  view/serializer; the rest → a service function.
- **`g`, `current_app`, `session` globals.** Replace request-context globals with
  explicit function arguments so services have no Flask dependency.
- **Blueprints** map naturally to the app's route module; one blueprint usually becomes
  one `utils/api/routes/{name}.py`.
- **Marshmallow schemas** become DRF serializers (API) and/or `shared/schemas.py` DTOs
  (services + tools).

## Parity mapping

Each meaningful route becomes a service function with both a DRF view and an
`agent/tools.py` tool. Destructive routes get `confirm: true` on the tool side.
