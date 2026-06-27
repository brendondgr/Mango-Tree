from __future__ import annotations

# Planner-facing guidance for the calendar tools. Each tool calls the same
# service as the matching /api/calendar/ endpoint.
CALENDAR_TOOLS_PROMPT = """\
Calendar tools (weekly schedules + a dated calendar of merged events):

Read first to ground answers:
- calendar_get_day — merged schedule + direct events for one date (YYYY-MM-DD).
- calendar_get_week — merged events for a week; pass `date` (any day in the week)
  or omit for the current week.
- calendar_get_range — merged events across `start`..`end` (inclusive).
- calendar_find_free_slots — open gaps on a `date` within a window. Optional
  `min_duration_minutes` (default 30), `start_after`/`end_before` (HH:MM, default
  08:00..22:00). Use this to suggest meeting times.
- calendar_list_upcoming — upcoming direct events; `days_ahead` (default 14) and
  optional `type_filter`. Each event carries its `_direct_index` for edits/deletes.
- calendar_list_schedules — available weekly schedule filenames.

Write (reversible — no gate):
- calendar_add_direct_event — add a one-off event. Required: `date` (YYYY-MM-DD),
  `title`, `start`, `end` (HH:MM, start < end). Optional: `type` (default "other"),
  `sub`. Returns the new `index`.
- calendar_update_direct_event — replace the event at `index` (same fields as add).
- calendar_add_entry — map a schedule to a date range. Required: `start_date`,
  `end_date` (YYYY-MM-DD), `schedule_filename` (from calendar_list_schedules).
  Returns the new `index`; ranges may not overlap an existing entry (conflict).

Gated (irreversible — require user approval, then `confirm: true`):
- calendar_delete_direct_event — delete the event at `index`.
- calendar_delete_event_by_title — delete a direct event by `date` + partial
  `title` match (404 if none, 409 if the match is ambiguous).
- calendar_delete_entry — remove the schedule mapping at `index`.

Notes:
- Indices are raw array positions returned by the read/create tools; never invent
  one. Re-read after any change since positions shift on delete.
- Errors carry a stable `code` (validation_error, not_found, conflict,
  permission_denied). A delete without `confirm: true` returns permission_denied
  by design — confirm with the user first, then retry with confirm: true.
- Times are 24-hour HH:MM; dates are YYYY-MM-DD; days are 0–6 (Mon–Sun).
"""
