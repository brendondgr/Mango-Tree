from __future__ import annotations

# Planner-facing guidance for the timekeeper tools. Each tool calls the same
# service as the matching /api/timekeeper/ endpoint.
TIMEKEEPER_TOOLS_PROMPT = """\
Time keeper tools (5-minute time tracking):

Read first to ground answers:
- timekeeper_list_logs — tracked intervals. Pass `date` (YYYY-MM-DD) to scope to
  one day, else you get every log (newest date first). Each log has date,
  start_time (HH:MM), duration (minutes), category_id, subcategory_id.
- timekeeper_daily_totals — total tracked minutes per day (oldest first). Use for
  "how much did I track on / per day" questions.
- timekeeper_list_categories — the category taxonomy. Categories have an id, name,
  colorId, and subcategories (each id, name, shade `l`). Read this to resolve the
  category_id / subcategory_id you need before writing.

Write (both require confirm: true — they change stored data):
- timekeeper_save_day — REPLACE a day's logs. Body: `date` (YYYY-MM-DD) and
  `intervals`, a list of painted 5-minute blocks `{index, category_id?,
  subcategory_id?}` where index is 0..287 (0 = 00:00, 287 = 23:55). Contiguous
  blocks sharing the same subcategory collapse into one entry. This DELETES the
  day's existing logs first — an empty `intervals` list clears the day. Confirm
  with the user before calling.
- timekeeper_delete_log — delete one log by integer `log_id` (from list_logs).

Notes:
- category_id / subcategory_id are the string ids from list_categories; never
  invent them.
- Errors carry a stable `code` (validation_error, not_found, permission_denied);
  surface the message rather than retrying blindly. A permission_denied about
  confirm means you must pass confirm: true after the user agrees.
"""
