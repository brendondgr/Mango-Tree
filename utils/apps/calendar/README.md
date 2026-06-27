# Calendar

Domain app module under `utils/apps/calendar/`. A weekly-schedule + calendar
planner ported from a standalone Flask app. Build reusable weekly **schedules**
(templates of recurring events), map them onto **date ranges**, drop in one-off
**direct events**, and view the merged result by day / week / range. Reachable
identically from the DRF API and from curated agent tools, over the same
file-based JSON stores.

## Layout

```text
utils/apps/calendar/
├── backend/
│   ├── api/          # DRF views + serializers (thin)
│   ├── services/
│   │   ├── store.py        # path resolution + atomic JSON IO + seed-on-first-run
│   │   ├── schedules.py    # schedule CRUD, events, colors+stats+breakdowns
│   │   ├── calendar.py     # config, entries, direct events, day/week/range merge
│   │   └── pdf.py          # themed PDF export of a schedule view
│   └── seed/         # committed copy of the original data (seeds data/calendar/)
├── frontend/         # React calendar grid + schedule editor, via the @calendar alias
├── agent/            # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/           # DTOs, typed errors, and pure domain helpers
    ├── date_utils.py   # date/time parsing, week/month ranges, day-of-week
    ├── event_merger.py # merge/split schedule vs direct events (overwriteable)
    ├── stats.py        # per-category hour stats with overlap accounting
    ├── validators.py   # event/schedule validation + sanitize_filename
    ├── colors.py       # 16-color palette + dynamic per-type color generation
    ├── schemas.py      # DTOs (Schedule, Event, CalendarEntry, DirectEvent, views)
    └── errors.py       # CalendarError + typed subclasses (5 platform codes)
```

## Data stores (local-first)

No database. Two JSON stores plus an instructions file, under `data/calendar/`
(override `MANGO_CALENDAR_DATA_DIR`):

| File | Shape |
| --- | --- |
| `calendar.json` | `{ entries: [{start_date, end_date, schedule_filename}], direct_events: [{date, title, type, start, end, sub}] }` |
| `schedules/<name>.json` | `{ name, description?, events: [...], color_mappings: {type: color_name} }` |
| `instructions.md` | LLM prompt describing the schedule JSON schema |

`data/` is gitignored, so the original content is committed at `backend/seed/`
and copied into `data/calendar/` on first run when the target is missing
(non-destructive: never overwrites existing files). Writes are atomic
(tempfile + `os.replace`).

**Event format (dual, both preserved):** an event has `title`, `type`, optional
`sub`, optional `overwriteable` (default `false`), and either legacy flat
`day`/`start`/`end` **or** a `timestamps: [{day, start, end}]` list. `day` is an
int `0–6` (Mon–Sun) or a list of ints. Non-overwriteable events take priority and
split overlapping `overwriteable` ("background") blocks in the merged view and in
stats.

## HTTP API

Base prefix `/api/calendar/`. Documented in `docs/api.md` under **Calendar**. DRF
routes: `utils/api/routes/calendar.py`. Views call `backend/services/` only — the
same services the agent tools call (API ↔ agent parity).

## Agent tool contract (curated)

Single source of truth. `agent/tools.py`, `agent/prompts.py`, and
`config/tools.yaml` derive from this table and must not drift.

| Tool name | Args | Kind | Gate |
| --- | --- | --- | --- |
| `calendar_list_schedules` | — | read | none |
| `calendar_get_day` | `date` | read | none |
| `calendar_get_week` | `date?` | read | none |
| `calendar_get_range` | `start`, `end` | read | none |
| `calendar_find_free_slots` | `date`, `min_duration_minutes?`, `start_after?`, `end_before?` | read | none |
| `calendar_list_upcoming` | `days_ahead?`, `type_filter?` | read | none |
| `calendar_add_direct_event` | `date`, `title`, `type`, `start`, `end`, `sub?` | mutating | none |
| `calendar_update_direct_event` | `index`, `date`, `title`, `type`, `start`, `end`, `sub?` | mutating | none |
| `calendar_delete_direct_event` | `index`, `confirm=false` | irreversible | **`confirm: true`** |
| `calendar_delete_event_by_title` | `date`, `title`, `confirm=false` | irreversible | **`confirm: true`** |
| `calendar_add_entry` | `start_date`, `end_date`, `schedule_filename` | mutating | none |
| `calendar_delete_entry` | `index`, `confirm=false` | irreversible | **`confirm: true`** |

**Enforcement is in code, never in the prompt.** Confirm gates are checked in
`tools.py`; filesystem scope is enforced via `config/permissions.yaml`
(`calendar_data`). Schedule authoring (create/save/delete schedules, schedule-event
CRUD, color-mapping edits, PDF export) is **API-only by deliberate choice** — UI
authoring surfaces an assistant rarely needs.

## Frontend

Imported by `web/` via the `@calendar` Vite alias. API client:
`web/src/services/calendarClient.ts`; data fetching uses TanStack Query hooks in
`frontend/hooks/`. The UI opens as a **persistent workspace tab** (the Calendar
icon on the chat nav rail): a month/week grid of merged events, a schedule editor
with a 16-color palette, and a themed PDF export.

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Filenames are sanitized (`sanitize_filename`) to block path traversal.

See `docs/skills/app-modules/`.
