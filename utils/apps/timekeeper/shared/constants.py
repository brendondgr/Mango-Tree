from __future__ import annotations

# Django database alias for the legacy TimeKeeper SQLite file. The connection is
# registered in config/django/settings.py and routed by
# utils.apps.timekeeper.backend.db_router.TimekeeperRouter.
DB_ALIAS = "timekeeper"

# Default page size for list endpoints (platform default).
DEFAULT_PAGE_SIZE = 25

# The tracker paints a day as fixed 5-minute blocks. Index 0 == 00:00, and a day
# has 24*60/5 == 288 blocks (valid indices 0..287).
BLOCK_MINUTES = 5
BLOCKS_PER_DAY = (24 * 60) // BLOCK_MINUTES  # 288
MAX_BLOCK_INDEX = BLOCKS_PER_DAY - 1  # 287

# The single settings row that stores the category taxonomy JSON.
CATEGORIES_KEY = "categories"

# Colour ids the UI understands for a category base colour. Stored verbatim in
# the category JSON as ``colorId``; the backend does not otherwise constrain the
# free-form taxonomy, but new categories default to this list in the UI.
CATEGORY_COLORS = (
    "green",
    "blue",
    "purple",
    "red",
    "orange",
    "teal",
    "yellow",
    "pink",
)
DEFAULT_CATEGORY_COLOR = "blue"
