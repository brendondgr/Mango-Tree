# Migrating a Django source app

Use this when Stage 0 detects Django (`manage.py`, `settings.py`, `INSTALLED_APPS`,
`urls.py`, ORM `models.Model`).

This is the easiest source because the target is also Django/DRF. The work is mostly
*relocation and de-entanglement*, not translation.

## Where each responsibility lives

| Responsibility | Typical Django location | Target |
| --- | --- | --- |
| Data models | `*/models.py` | `utils/apps/{name}/backend/models/` |
| Migrations | `*/migrations/` | `utils/apps/{name}/backend/models/migrations/` |
| Business logic | often inside `views.py` / `viewsets` / `forms.py` | `backend/services/` (extract) |
| Existing service layer | `*/services.py`, `*/selectors.py` | `backend/services/` (move) |
| HTTP routes | `urls.py` + views/DRF viewsets | `backend/api/` + `api/routes/{name}.py` |
| Serializers | `serializers.py` | `backend/api/serializers.py` |
| Background jobs | Celery `tasks.py`, management commands | `backend/tasks/` |
| Validators / utils | `validators.py`, `utils.py` | `shared/` |
| Settings/DB config | `settings.py` `DATABASES` | platform `config/django/settings` (see DB preservation) |
| Templates / static | `templates/`, `static/` | discard; rebuild as `frontend/` + tab |
| Auth | Django auth / DRF permissions | reconcile with `utils/shared/auth` + `permissions` |

## Extraction notes

- **De-fatten views.** If a view or DRF viewset method contains domain logic (DB
  writes, calculations, external calls), move that into a service function and have the
  view call it. The view should end up validating input, calling one service, and
  serializing output.
- **Keep migrations.** Carry the existing migration history so Django recognizes the
  current schema state. If you instead bind to an existing DB, see
  `../database-preservation.md` (bind-to-existing strategy).
- **Class-based DRF → services.** A `ModelViewSet` hides logic in the ORM defaults;
  make each meaningful action (create/update/delete with side effects) call an explicit
  service so the agent tool can call the identical function.
- **Signals.** Django signals are a common hiding place for business rules. Inventory
  `signals.py` and `apps.py` `ready()` hooks; decide whether each becomes a service
  call or stays a signal.
- **Management commands** that do real work become Celery tasks or service entrypoints.

## Parity mapping

For each DRF action you keep, define the matching `agent/tools.py` function calling the
same service. A `ModelViewSet` with create/retrieve/update/destroy typically maps to
four tools (with `confirm: true` on destroy).
