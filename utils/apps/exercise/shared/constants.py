from __future__ import annotations

# Django database alias for the legacy WorkoutTracker SQLite file.
# The connection is registered in config/django/settings.py and routed by
# utils.apps.exercise.backend.db_router.ExerciseRouter.
DB_ALIAS = "exercise"

# Default page size for list endpoints (platform default).
DEFAULT_PAGE_SIZE = 25

# Days of week used as keys in a routine's workout schedule.
WEEKDAYS = ("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
