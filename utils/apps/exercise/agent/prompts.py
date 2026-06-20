from __future__ import annotations

# Planner-facing guidance for the exercise tools. Each tool calls the same
# service as the matching /api/exercise/ endpoint.
EXERCISE_TOOLS_PROMPT = """\
Exercise tracker tools (workouts, routines, equipment, history):

Read first to ground answers:
- exercise_list_workouts / exercise_list_routines / exercise_list_equipment
- exercise_list_history — logged sessions; use for progress, volume, and streak
  questions. Each log has a date, duration (seconds), volume, and exercises.

Write:
- exercise_log_workout — record a completed session into history. Provide a
  unique `id`, a `workout_id` (use "run"/"walk" for cardio, or an existing
  workout's id), `date`, `duration`, `volume`, and the `exercises` performed.
- exercise_save_workout / exercise_save_routine — create or update a template
  (upsert on `id`).
- exercise_add_equipment / exercise_update_equipment.

Destructive (require confirm: true after the user explicitly approves):
- exercise_delete_workout, exercise_delete_routine, exercise_delete_equipment,
  exercise_delete_log.

Notes:
- IDs are opaque strings (e.g. "wk_…", "hist_…"); reuse the exact id returned by
  a read tool. Never invent an id for an update/delete.
- Returned errors carry a stable `code` (validation_error, not_found, conflict,
  permission_denied); surface the message to the user rather than retrying blindly.
"""
