# Migrating an Express / Node source app

Use this when Stage 0 detects Express/Node (`package.json` with `express`,
`app.get/post`, routers, an ORM like Prisma/Sequelize/TypeORM/Knex).

This is the hardest case because the source is **JavaScript/TypeScript** and the target
backend is **Python**. You are translating language *and* framework. Plan for more
effort and more tests. The data, however, can still be preserved unchanged.

## Where each responsibility lives

| Responsibility | Typical Express location | Target |
| --- | --- | --- |
| Data models / schema | Prisma `schema.prisma`, Sequelize/TypeORM models, Knex migrations | source of truth for the existing schema |
| Business logic | inline in route handlers, `controllers/`, `services/` | `backend/services/` (re-implement in Python) |
| HTTP routes | `express.Router()`, `app.use()` | `backend/api/` + `utils/api/routes/{name}.py` |
| Validation | Joi/Zod/express-validator | `shared/schemas.py` + DRF serializers |
| Background jobs | BullMQ, Agenda, node-cron | `backend/tasks/` (inline — no broker) |
| DB config | `DATABASE_URL` / ORM config | platform DB config (see DB preservation) |
| Auth | Passport/JWT middleware | `utils/shared/auth` + `permissions` |
| Views / static | EJS/Pug templates, `public/` | discard; rebuild as `frontend/` + tab |

## Strategy: treat it as a spec, not code to port

You cannot relocate JS files into a Python module. Instead:

1. **Read the schema as the contract.** The Prisma/Sequelize/TypeORM schema (or Knex
   migrations) defines the existing tables. Recreate equivalent Django models that bind
   to those exact tables (`Meta.db_table`, matching columns, `managed = False`) per
   `../database-preservation.md`. The data never moves; only the access layer changes
   language.
2. **Re-implement each controller/service as a Python service.** Read the handler,
   write the equivalent `backend/services/` function with the same inputs, outputs, and
   side effects. Verify behavior against the source with tests, not by eye.
3. **Translate validation schemas** (Zod/Joi) into DRF serializers + `shared/schemas.py`
   DTOs.
4. **Map middleware to platform equivalents** — auth middleware → `utils/shared/auth`;
   rate limiting/logging → platform middleware in `utils/api/middleware/`.

## Cross-language gotchas

- **Decimal/money:** JS numbers are floats; Python `Decimal` differs. Preserve the
  column type and use `Decimal` in services to avoid rounding drift on existing data.
- **Dates/timezones:** match the stored format and tz handling exactly.
- **JSON columns:** Postgres `jsonb` maps to Django `JSONField`; keep the same keys.
- **Enum handling:** mirror the stored enum values, not the JS enum names.
- **ID strategy:** if the source uses cuid/uuid/auto-increment, keep the same column
  type and generation so existing and new IDs stay compatible.

## Parity mapping

Each capability re-implemented as a service is exposed through both a DRF view and an
`agent/tools.py` tool. Because this is a re-implementation, **lean on tests** to prove
the Python service matches the original Node behavior before wiring the API and tools.
