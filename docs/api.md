# API Contract

The contract between the React/Vite frontend and the Django/DRF backend. Every
endpoint listed here is implemented; nothing in this document is aspirational.

## Base URL

All endpoints are prefixed with `/api/`. The root URLconf is
`config/django/urls.py`, which includes one module per app from
`utils/api/routes/`.

In development the SPA reaches the backend through the Vite proxy, which
forwards `/api` to `http://127.0.0.1:32553` with `changeOrigin: false` so
Django's CSRF origin check still passes.

## Error Schema

```json
{
  "code": "permission_denied",
  "message": "Human-readable summary.",
  "details": {}
}
```

Stable codes: `validation_error`, `permission_denied`, `not_found`, `conflict`, `rate_limited`, `internal_error`.

## Authentication

The platform is single-owner and gated. Every endpoint requires an authenticated
session (DRF `SessionAuthentication` + a global `IsAuthenticated` default) except
the public endpoints noted below (`/api/health/` and the `/api/auth/` login,
signup, csrf, and registration-status routes). Unauthenticated requests return
`403`.

Auth uses Django sessions carried in an **httpOnly** cookie; state-changing
requests must echo the CSRF token (from the readable `csrftoken` cookie) in the
`X-CSRFToken` header. The SPA primes the cookie via `GET /api/auth/csrf/`.

### Auth & Security (`/api/auth/`)

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/csrf/` | public | Set the CSRF cookie; returns `{csrftoken}` |
| `GET` | `/registration-status/` | public | `{registration_open, owner_exists}` |
| `POST` | `/signup/` | public\* | Create the single owner account; logs in. `*` closed once an owner exists (`403`) |
| `POST` | `/login/` | public | Session login. Failed attempts are logged; an IP is locked (`429`) after too many failures |
| `POST` | `/logout/` | owner | End the session (`204`) |
| `GET` | `/me/` | owner | `{id, username, is_owner, preferences}` |
| `GET/PATCH` | `/preferences/` | owner | Read/update `{enabled_apps, onboarding_completed}` |
| `GET` | `/security/attempts/` | owner | Recent login attempts `{username, ip_address, successful, created_at}` |
| `GET` | `/security/lockouts/` | owner | Currently blocked IPs `{ip_address, failed, retry_after_seconds}` |
| `POST` | `/security/unlock/` | owner | Clear an IP's lockout counter (log preserved) |

Routes: `utils/api/routes/auth.py`; views call `utils/shared/auth/services/` only.

## Platform Endpoints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health/` | public | `{"status":"ok"}` when Django is running |
| `POST` | `/api/agent/{session_id}/agent_turn/` | owner | Run one agent turn; streams SSE |
| `GET` | `/api/tools/groups/` | owner | The agent tool-group catalogue |

There are no task, workflow, memory, or trace endpoints. Agent turns are
stateless on the server: the client sends the full message history each turn and
nothing about the turn is persisted.

### Agent turn

`POST /api/agent/{session_id}/agent_turn/` runs the coordinator graph
(`utils/agents/coordinator/graph.py`) and streams progress back as
Server-Sent Events.

Request body:

| Field | Purpose |
| --- | --- |
| `messages` | The conversation so far |
| `enabled_groups` | Tool groups this turn may use. Unknown group → `validation_error`; a group whose `requires` capability is unmet → `permission_denied` |
| `workspace_id` | Optional; satisfies the `workspace` capability for group gating |
| `web_search_mode` | `auto` (default) or `forced` |
| `llm_config` | Optional per-request `base_url` / `model` / `api_key` override; falls back to the `LLM_*` environment defaults |

Event stream: `node_start`, `tool_call`, `tool_result`, `final_answer`, `error`.
The final answer carries de-duplicated citations collected from `search_web`
results. The loop runs at most six reason/act/observe cycles per turn.

Errors map `validation_error` → `400` and `permission_denied` → `403`.

### Tools

Read-only catalogue of the agent tool groups the session toggle UI controls
(see `docs/tool-groups.md`). Group membership derives from each tool's `app` in
`config/tools.yaml`; `core` is on by default and the app groups are off until the
user enables them. The enabled set is not stored server-side — it is sent per
turn on `POST /api/agent/{session_id}/agent_turn/` as `enabled_groups` (with an
optional `workspace_id`), validated there (unknown group → `validation_error`; a
group whose `requires` capability is unmet → `permission_denied`).

`GET /api/tools/groups/` →

```json
{
  "groups": [
    {
      "id": "core",
      "label": "Core",
      "tools": ["inspect_chat_context", "inspect_skills", "list_artifacts",
                "read_artifact", "read_skill", "search_web"],
      "default_enabled": true
    },
    {
      "id": "mailbox",
      "label": "Mailbox",
      "tools": ["mailbox_list_accounts", "mailbox_send_message", "..."],
      "default_enabled": false
    }
  ]
}
```

A group may also carry `"requires": "<capability>"` when it is gated behind a
session precondition (none today). `core` is always listed first.

## App Endpoints

Eight apps are routed: calendar, media viewer, mailbox, exercise, project
manager, IMDbSpy, time keeper, and recipes. Each section below matches the
corresponding module in `utils/api/routes/`.

`utils/apps/{jobs,notes,projects}/` are empty placeholders with no endpoints.

### Calendar

Weekly-schedule + calendar planner, migrated from a standalone Flask app. Build
reusable weekly **schedules**, map them onto date ranges (**entries**), drop in
one-off **direct events**, and read the merged result by day/week/range. No
database — state lives in file-based JSON stores (`data/calendar/calendar.json`,
`data/calendar/schedules/*.json`), seeded on first run from a committed copy. See
`utils/apps/calendar/README.md`. DRF routes: `utils/api/routes/calendar.py`; views
call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/calendar/schedules/` | `schedules.list_schedules` | List schedule filenames (`{schedules, count}`) |
| `POST` | `/api/calendar/schedules/` | `schedules.save_schedule` | Save/upload a schedule (JSON body or multipart `file`) |
| `GET` | `/api/calendar/schedules/{file}/` | `schedules.get_schedule_detail` | Schedule + `{colors, stats, breakdowns}` (events expanded) |
| `DELETE` | `/api/calendar/schedules/{file}/` | `schedules.delete_schedule` | Delete schedule; cascade-removes its entries (`{removed_mappings}`) |
| `PUT` | `/api/calendar/schedules/{file}/color-mappings/` | `schedules.update_color_mappings` | Replace `color_mappings` (body = `{type: color_name}`) |
| `POST` | `/api/calendar/schedules/{file}/categories/rename/` | `schedules.rename_category` | Rename a category across all events (body = `{old, new}`) → `{updated}` |
| `POST` | `/api/calendar/schedules/{file}/events/` | `schedules.add_event` | Append an event (`{index}`) |
| `PUT` | `/api/calendar/schedules/{file}/events/{i}/` | `schedules.update_event` | Replace the event at raw index `i` |
| `DELETE` | `/api/calendar/schedules/{file}/events/{i}/` | `schedules.delete_event` | Delete the event at raw index `i` |
| `POST` | `/api/calendar/schedules/{file}/print/` | `pdf.generate_schedule_pdf` | Render a themed PDF for a view (`{timeRange, daysRange, hiddenCategories}`) → `application/pdf` |
| `GET` | `/api/calendar/colors/` | `schedules.predefined_colors` | The 16-color palette for the picker |
| `GET` | `/api/calendar/instructions/` | `schedules.load_instructions` | LLM schema prompt (`{content}`) |
| `GET` | `/api/calendar/config/` | `calendar.load_calendar` | Raw calendar config (`{entries, direct_events}`) |
| `GET` | `/api/calendar/date/{date}/` | `calendar.day_view` | Merged events for a date (`{events, colors, schedule_filename}`) |
| `GET` | `/api/calendar/week/` | `calendar.week_view` | Merged events for a week (`?date=`; default current) |
| `GET` | `/api/calendar/range/` | `calendar.range_view` | Merged events across `?start=&end=` |
| `POST` | `/api/calendar/entries/` | `calendar.add_calendar_entry` | Map a schedule to a date range (`{index}`; 409 on overlap) |
| `PUT` | `/api/calendar/entries/{i}/` | `calendar.update_calendar_entry` | Update an entry |
| `DELETE` | `/api/calendar/entries/{i}/` | `calendar.delete_calendar_entry` | Delete an entry |
| `POST` | `/api/calendar/events/` | `calendar.add_direct_event` | Add a one-off direct event (`{index}`) |
| `PUT` | `/api/calendar/events/{i}/` | `calendar.update_direct_event` | Update a direct event |
| `DELETE` | `/api/calendar/events/{i}/` | `calendar.delete_direct_event` | Delete a direct event |
| `POST` | `/api/calendar/events/delete-by-title/` | `calendar.delete_event_by_title` | Delete by `{date, title}` (404 none, 409 ambiguous) |
| `GET` | `/api/calendar/free-slots/` | `calendar.free_slots` | Free gaps on `?date=` (`?min_duration_minutes=&start_after=&end_before=`) |
| `GET` | `/api/calendar/upcoming/` | `calendar.upcoming` | Upcoming direct events (`?days_ahead=14&type_filter=`) |

A schedule: `{name, description?, events: [...], color_mappings: {type: color_name}}`.
An event has `title`, `type`, optional `sub`/`overwriteable`, and either legacy flat
`day`/`start`/`end` or `timestamps: [{day, start, end}]`; `day` is `0–6` (Mon–Sun) or
a list. A direct event: `{date, title, type, start, end, sub?}`. Merged-view events
carry `_source` (`schedule`/`direct`) and split markers (`_split`). Indices in event
and entry routes are raw array positions returned by the read/create calls. Errors
use the platform schema with codes `validation_error` (400), `not_found` (404),
`conflict` (409). Filenames are sanitized server-side to block path traversal.

### Media Viewer (Artifacts)

Local artifact storage and streaming for the `/chat` workspace. See `utils/apps/media_viewer/README.md`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/media-viewer/artifacts/` | List artifacts (paginated, default 25, sort `-created_at`) |
| `POST` | `/api/media-viewer/artifacts/` | Upload + register artifact (`multipart/form-data`) |
| `GET` | `/api/media-viewer/artifacts/{id}/` | Artifact metadata |
| `DELETE` | `/api/media-viewer/artifacts/{id}/` | Delete artifact and files |
| `GET` | `/api/media-viewer/artifacts/{id}/content/` | Stream raw bytes (`Content-Disposition: inline` or `attachment`) |
| `GET` | `/api/media-viewer/artifacts/{id}/thumbnail/` | Stream thumbnail (404 when missing; UI falls back to kind icon) |

#### `POST /api/media-viewer/artifacts/` (multipart)

| Field | Required | Notes |
| --- | --- | --- |
| `file` | yes | Raw bytes |
| `source` | no | Default `manual`; chat integration sends `chat_upload` |
| `source_chat_session_id` | no | UUID string |
| `source_message_id` | no | UUID string |
| `poster` | no | Optional image for video poster (client-extracted frame) |

#### List response

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "filename": "diagram.png",
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

Artifact kinds: `image`, `video`, `pdf`, `markdown`, `latex`, `text`, `unknown`.

### Mailbox

Multi-provider mailbox (Gmail, Microsoft 365, on-prem Exchange, Yahoo). Account
*settings* persist to a local file (`data/mailbox/accounts.json`); credentials
live in a separate `0600` secret store (`data/mailbox/secrets.json`), referenced
from settings only by a `credential_ref` key name. See `utils/apps/mailbox/README.md`.
DRF routes: `utils/api/routes/mailbox.py`; views call `backend/services/` only.

**Secrets are never serialized back.** CRUD returns account settings plus a
derived `has_credential` boolean; the credential endpoint is write-only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/mailbox/accounts/` | `config_store.list_accounts` | List configured mailboxes (settings only) |
| `POST` | `/api/mailbox/accounts/` | `config_store.save_account` | Create a mailbox (settings; id generated) |
| `PUT` | `/api/mailbox/accounts/{id}/` | `config_store.save_account` | Update a mailbox (upsert on `id`) |
| `DELETE` | `/api/mailbox/accounts/{id}/` | `config_store.delete_account` | Remove a mailbox (and its credential) |
| `PUT` | `/api/mailbox/accounts/{id}/credential/` | `secrets.set_credential` | Store the credential (write-only; never echoed) |
| `POST` | `/api/mailbox/accounts/{id}/test/` | `providers.test_account` | Test connectivity; updates `status` |
| `GET` | `/api/mailbox/oauth/start/?provider=` | `oauth.flow.build_authorize_url` | Begin the OAuth portal flow (Gmail/M365); returns `{authorize_url}` |
| `GET` | `/api/mailbox/oauth/callback/` | `oauth.flow.complete_login` | Provider redirect target; creates the account, redirects to the SPA |
| `GET` | `/api/mailbox/accounts/{id}/folders/` | `messages.list_folders` | Folder tree for one account |
| `GET` | `/api/mailbox/accounts/{id}/messages/` | `messages.cached_messages` | Cached messages, newest first (`?folder=INBOX&limit=25`; `limit=all`/absent returns the whole cache). No network — see `/sync/` |
| `GET`/`POST` | `/api/mailbox/accounts/{id}/sync/` | `messages.sync_status` / `messages.start_sync` | Inspect / trigger an incremental background sync into the local cache |
| `GET` | `/api/mailbox/accounts/{id}/messages/{uid}/` | `messages.get_message` | One message with decoded body (cached after first open) |
| `POST` | `/api/mailbox/accounts/{id}/organize/` | `mailops.organize` | Move one message by UID (reversible) |
| `POST` | `/api/mailbox/accounts/{id}/move/` | `mailops.move` | Batch-move messages: body `{uids[], dest, source?, create_if_missing?}` (reversible) |
| `POST` | `/api/mailbox/accounts/{id}/mark/` | `mailops.mark` | Mark read/unread and/or starred: body `{uids[], read?, starred?, source?}` (tri-state; reversible) |
| `POST` | `/api/mailbox/accounts/{id}/delete/` | `mailops.delete` | Delete messages: body `{uids[], source?, permanent?, confirm?}`. Soft (Trash) is reversible; `permanent: true` needs `confirm: true` (else 403) |
| `POST` | `/api/mailbox/accounts/{id}/reply/` | `mailops.reply` | Reply/reply-all (threaded): body `{uid, body, html?, reply_all?, source?, confirm}`. Irreversible — needs `confirm: true` (else 403) |

**Gmail/M365 use the OAuth portal, not a token field.** `GET /oauth/start/?provider=gmail` returns `{authorize_url}`; the SPA opens it, the user signs in on the provider's own page, and the provider redirects to `/oauth/callback/`, which validates the one-time `state`, exchanges the code (Authorization Code + PKCE), stores the **refresh token** in the secret store, upserts the account from the verified email, and redirects the browser to the SPA with `?mailbox_added=<id>`. Short-lived access tokens are minted from the refresh token on demand. Requires `OAUTH_GMAIL_CLIENT_ID`/`OAUTH_M365_CLIENT_ID` (and secrets) in the environment. The `PUT .../credential/` endpoint is for **app passwords only** (Yahoo/Exchange): body `{"value": "<app password>"}`, write-only, echoes only `{id, credential_ref, has_credential}`.

An account settings object: `{id, provider, display_name, email, enabled, credential_ref, status, use_graph, imap_host, imap_port, smtp_host, smtp_port, has_credential}` — `status` is `untested`/`ok`/`error`. A message object: `{uid, message_id, provider, account, subject, from, to, date, timestamp, snippet, flags, unread, body_text, body_html}` — `timestamp` is epoch seconds parsed from the `Date` header (0 when unparseable) and is what the inbox sorts on; `body_*` are populated only by the detail endpoint. The messages response also carries a `sync` object: `{state: idle|syncing|error, processed, total, new, removed, error, updated_at}`. The messages list reads the local cache (`data/mailbox/cache/`) and never touches the network; `POST /sync/` runs an incremental IMAP sync in the background (only new UIDs are fetched), so the whole folder is downloaded once and then updated. `POST /sync/` denies with `permission_denied` (403) when the account has no stored credential. Errors use the platform schema (`validation_error` 400, `permission_denied` 403, `not_found` 404, `conflict` 409, `provider_error` 502). Reads against an account with no stored credential return `permission_denied` (403); no network is attempted.

### Exercise

Workout/routine/equipment/history tracking with Strava import, migrated from the standalone WorkoutTracker app. See `utils/apps/exercise/README.md`. Data lives in the legacy SQLite store at `data/exercise/workouttracker.db` (bound read/write, schema unchanged). DRF routes: `utils/api/routes/exercise.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/exercise/workouts/` | `workouts.list_workouts` | List workout templates |
| `POST` | `/api/exercise/workouts/` | `workouts.save_workout` | Create/update a workout (upsert on `id`) |
| `DELETE` | `/api/exercise/workouts/{id}/` | `workouts.delete_workout` | Delete a workout |
| `GET` | `/api/exercise/routines/` | `routines.list_routines` | List weekly routines |
| `POST` | `/api/exercise/routines/` | `routines.save_routine` | Create/update a routine (upsert on `id`) |
| `DELETE` | `/api/exercise/routines/{id}/` | `routines.delete_routine` | Delete a routine |
| `GET` | `/api/exercise/equipment/` | `equipment.list_equipment` | List equipment |
| `POST` | `/api/exercise/equipment/` | `equipment.add_equipment` | Create equipment (409 on duplicate `id`) |
| `PUT` | `/api/exercise/equipment/{id}/` | `equipment.update_equipment` | Update equipment |
| `DELETE` | `/api/exercise/equipment/{id}/` | `equipment.delete_equipment` | Delete equipment |
| `GET` | `/api/exercise/history/` | `history.list_history` | List logged sessions |
| `POST` | `/api/exercise/history/` | `history.add_log` | Add a logged session (409 on duplicate `id`) |
| `PUT` | `/api/exercise/history/{id}/` | `history.update_log` | Update a logged session |
| `DELETE` | `/api/exercise/history/{id}/` | `history.delete_log` | Delete a logged session |
| `POST` | `/api/exercise/strava/sync/` | `strava.sync_strava` | Import Strava run/walk activities into history (body `{"period": "week"\|"all"}`) |

List endpoints return the standard envelope `{count, next, previous, results}` (default `page_size` 25, max 2000 via `?page_size=`). `POST`/`PUT` echo the saved object; `DELETE` returns `204`. Errors use the platform schema with codes `validation_error` (400), `not_found` (404), `conflict` (409).

IDs are the legacy string keys (`wk_…`, `rt_…`, `eq_…`, `hist_…`, `strava_…`). `history.workout_id` may be `run`/`walk` (cardio/Strava) and is not constrained to an existing workout. Strava sync endpoint: added in Stage 7.

### Project Manager

Projects, goals, deadlines, and a Gantt timeline, migrated from the standalone ProjectManager (Flask) app. See `utils/apps/projectmanager/README.md`. Data lives in the legacy SQLite store at `data/projectmanager/projectmanager.db` (bound read/write, schema unchanged; `managed = False` models). DRF routes: `utils/api/routes/projectmanager.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projectmanager/projects/` | `projects.list_projects` | List projects (category, progress, goal counts) |
| `POST` | `/api/projectmanager/projects/` | `projects.create_project` | Create a project (resolves/creates its category) |
| `GET` | `/api/projectmanager/projects/{id}/` | `projects.get_project` | Project detail |
| `PATCH` | `/api/projectmanager/projects/{id}/` | `projects.update_status` | Update status (body `{"status": ...}`; stamps lifecycle dates) |
| `DELETE` | `/api/projectmanager/projects/{id}/` | `projects.delete_project` | Delete a project and its goals |
| `GET` | `/api/projectmanager/projects/{id}/goals/` | `goals.list_goals_for_project` | List a project's goals |
| `POST` | `/api/projectmanager/projects/{id}/goals/` | `goals.create_goals` | Create goals (body `{"goals": [{title, deadline?}, ...]}`) |
| `GET` | `/api/projectmanager/goals/deadlines/` | `goals.list_goals_with_deadlines` | List all goals with a deadline (soonest first) |
| `PATCH` | `/api/projectmanager/goals/{id}/` | `goals.update_goal` | Update a goal's title/deadline |
| `POST` | `/api/projectmanager/goals/{id}/toggle/` | `goals.toggle_goal` | Toggle Pending/Completed |
| `DELETE` | `/api/projectmanager/goals/{id}/` | `goals.delete_goal` | Delete a goal |
| `GET` | `/api/projectmanager/categories/` | `categories.list_categories` | List categories |
| `GET` | `/api/projectmanager/timeline/dashboard/` | `timeline.dashboard_timeline` | Gantt data for all projects + goals (filters: `status`, `type`, `project_id`, `start_date`, `end_date`) |
| `GET` | `/api/projectmanager/timeline/project/{id}/` | `timeline.project_timeline` | Gantt data scoped to one project |

List endpoints return the standard envelope `{count, next, previous, results}` (default `page_size` 25, max 2000 via `?page_size=`). Project/goal objects carry a computed `deadline_status` (`{display, css_class, date_formatted, is_overdue, is_approaching}`) when a deadline is set. IDs are integers (legacy autoincrement). Statuses: project `Active`/`Completed`/`On-Hold`/`Abandoned`, goal `Pending`/`Completed`. Errors use the platform schema with codes `validation_error` (400), `not_found` (404), `conflict` (409).

### IMDbSpy

Personal movie/TV tracker migrated from a standalone Flask app. Add titles by
IMDb URL/ID (metadata + poster + cast headshots are scraped and cached locally),
mark them seen/not-seen/abandoned, and rate them with weighted Fun/Grit/Comfort
scales. See `utils/apps/imdbspy/README.md`. Data lives in a dedicated SQLite store
at `data/imdbspy/imdbtracker.db` (`managed = True` models, Django owns the schema)
with images cached under `data/imdbspy/media/`. DRF routes:
`utils/api/routes/imdbspy.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/imdbspy/media/` | `media_items.list_media` | List titles (`{items, total, has_more}`); query `status`, `kind` (`movie`/`tv`), `search`, `limit`, `offset` |
| `POST` | `/api/imdbspy/media/add/` | `media_items.add_media` | Scrape + add titles (body `{urls: [...]}`); returns `{added, errors}` (per-item `errors` carry a `code`) |
| `POST` | `/api/imdbspy/media/refresh/` | `media_items.refresh_all` | Refresh metadata for all titles (no image re-download) |
| `POST` | `/api/imdbspy/media/{id}/status/` | `media_items.set_status` | Set status (body `{status}`: `seen`/`not_seen`/`abandoned`) |
| `PUT` | `/api/imdbspy/media/{id}/review/` | `media_items.update_review` | Weighted rating + review + seasons (body `{scale_type, *_rating, user_review?, seasons_seen?}`) |
| `PUT` | `/api/imdbspy/media/{id}/seasons/` | `media_items.update_seasons_seen` | Set watched-seasons count (TV only) |
| `DELETE` | `/api/imdbspy/media/{id}/` | `media_items.delete_media` | Delete a title (`204`) |
| `GET` | `/api/imdbspy/weights/` | `weights.get_weights` | List the three scales' criterion weights |
| `PUT` | `/api/imdbspy/weights/` | `weights.update_weights` | Update weights (body = array of `{scale_type, *_weight}`); recalculates affected titles |
| `GET` | `/api/imdbspy/assets/{path}` | `media.resolve_asset` | Serve a cached poster/headshot (path sanitized against traversal) |

The list endpoint returns a lightweight `{items, total, has_more}` envelope (not
the standard paginated envelope), preserving the original app's contract. `id` is
an integer. Statuses: `seen`/`not_seen`/`abandoned`; scales: `fun`/`grit`/
`comfort`. Errors use the platform schema with codes `validation_error` (400),
`not_found` (404), `conflict` (409). Rating-weights are an **API-only**
configuration surface (no agent tool).

### Recipes

A recipe book (browse/filter, pantry match, and recipe CRUD), migrated from a standalone Flask app. See `utils/apps/recipes/README.md`. Data lives in a SQLite store at `data/recipes/recipes.db` (bound read/write with `managed = False` models; schema owned by `backend/services/store.py` and seeded on first run). DRF routes: `utils/api/routes/recipes.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/recipes/recipes/` | `recipes.list_all` | List all recipes (summary cards with images) |
| `POST` | `/api/recipes/recipes/` | `recipes.create_recipe` | Create a recipe (structured ingredients + steps) |
| `POST` | `/api/recipes/recipes/filter/` | `recipes.filter_recipes` | Filter/rank by pantry `ingredient_ids`, `meal_types`, `cuisine_regions` (match %) |
| `GET` | `/api/recipes/recipes/{id}/` | `recipes.get_by_id` | Recipe detail (ingredients + ordered steps) |
| `PATCH`/`PUT` | `/api/recipes/recipes/{id}/` | `recipes.update_recipe` | Replace a recipe wholesale |
| `DELETE` | `/api/recipes/recipes/{id}/` | `recipes.delete_recipe` | Delete a recipe and its children |
| `GET` | `/api/recipes/ingredients/` | `ingredients.by_category` | Ingredient catalog grouped by category |
| `GET` | `/api/recipes/ingredients/search/?q=` | `ingredients.search` | Search ingredients (prefix-ranked) |
| `GET` | `/api/recipes/filter-options/` | `recipes.distinct_meal_types` / `distinct_cuisine_regions` | Distinct meal types + cuisine regions with counts |
| `POST` | `/api/recipes/parse/` | `parser.parse_recipe_text` | "AI Chef": parse recipe text → structured recipe (LLM; API-only) |
| `POST` | `/api/recipes/images/` | `images.save_uploaded_image` | Upload a recipe image (multipart `image`; API-only) |
| `GET` | `/api/recipes/images/{filename}` | `images.resolve_image_path` | Serve an uploaded image (traversal-safe; API-only) |

List endpoints return the standard envelope `{count, next, previous, results}` (default `page_size` 25, max 2000 via `?page_size=`). Recipe summaries carry `match_percentage` (0–100 or `null`), `total_ingredients`, and `matched_ingredients` when a pantry filter is active. IDs are integers (legacy autoincrement). The parser and image endpoints are **API-only** (not exposed as agent tools). Errors use the platform schema with codes `validation_error` (400), `permission_denied` (403), `not_found` (404), `conflict` (409).

### Time Keeper

Five-minute time tracking across user-defined categories, migrated from the standalone TimeKeeper (Flask) app. See `utils/apps/timekeeper/README.md`. Data lives in the legacy SQLite store at `data/timekeeper/timekeeper.db` (bound read/write, schema unchanged; `managed = False` models). DRF routes: `utils/api/routes/timekeeper.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/timekeeper/logs/` | `logs.list_logs` | List tracked intervals; `?date=YYYY-MM-DD` filters to one day |
| `POST` | `/api/timekeeper/logs/` | `logs.save_day` | Replace a day (body `{date, intervals:[{index, category_id?, subcategory_id?}]}`); empty `intervals` clears the day to a 0-min marker |
| `PUT` | `/api/timekeeper/logs/{id}/` | `logs.update_log` | Update a log's `start_time`/`duration`/`notes` |
| `DELETE` | `/api/timekeeper/logs/{id}/` | `logs.delete_log` | Delete a log |
| `GET` | `/api/timekeeper/stats/daily/` | `logs.daily_totals` | Total tracked minutes per day (`{days:[{date, total_duration}]}`) |
| `GET` | `/api/timekeeper/categories/` | `categories.get_categories` | The category taxonomy (`{categories:[...]}`) |
| `PUT` | `/api/timekeeper/categories/` | `categories.save_categories` | Replace the whole taxonomy (body = list, or `{categories:[...]}`) |

List endpoints return the standard envelope `{count, next, previous, results}` (default `page_size` 25, max 2000 via `?page_size=`). A log object is `{id, date, start_time, duration, category_id, subcategory_id, notes, created_at}`; `POST /logs/` echoes `{date, logs:[...]}`. Painted `index` values are 5-minute block indices (0 = 00:00 … 287 = 23:55); contiguous same-subcategory blocks collapse into one log row. A category is `{id, name, colorId, subcategories:[{id, name, l}]}` (free-form extra keys preserved). Errors use the platform schema with codes `validation_error` (400), `not_found` (404).

### Reserved (TBD)

_None — all migrated app endpoints (imdbspy, recipes, timekeeper) are documented above._

## Rules

- Responses must be structured and schema validated.
- Frontend must not assume an endpoint exists until listed here.
- Agent tools in `utils/apps/{app}/agent/tools.py` must call the same services backing these endpoints.
- Default pagination page size: 25.

## Implementation

| Concern | Location |
| --- | --- |
| Routes | `utils/api/routes/` |
| Serializers | `utils/api/serializers/`, `utils/apps/{app}/backend/api/` |
| Schemas | `utils/api/schemas/` |
| Middleware | `utils/api/middleware/` |

Platform overview: `docs/platform.md`.
