from __future__ import annotations

# Django database alias for the legacy ProjectManager SQLite file.
# The connection is registered in config/django/settings.py and routed by
# utils.apps.projectmanager.backend.db_router.ProjectManagerRouter.
DB_ALIAS = "projectmanager"

# Default page size for list endpoints (platform default).
DEFAULT_PAGE_SIZE = 25

# Lifecycle states preserved from the legacy app.
PROJECT_STATUSES = ("Active", "Completed", "On-Hold", "Abandoned")
GOAL_STATUSES = ("Pending", "Completed")

# Category colour suffixes understood by the UI; each maps to a CSS token
# (e.g. ``--projectmanager-cat-blue-*``). ``color`` on a Category stores one of
# these suffixes exactly as the legacy app stored it.
CATEGORY_COLORS = (
    "blue",
    "green",
    "purple",
    "orange",
    "red",
    "teal",
    "yellow",
    "pink",
)
DEFAULT_CATEGORY_COLOR = "blue"

# Status -> timestamp column updated when a project transitions into it.
STATUS_TIMESTAMP_FIELD = {
    "Completed": "date_completed",
    "On-Hold": "date_on_hold",
    "Abandoned": "date_abandoned",
}
