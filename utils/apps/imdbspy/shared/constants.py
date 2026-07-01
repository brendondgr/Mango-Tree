from __future__ import annotations

# Django database alias for the dedicated IMDbSpy SQLite file. Registered in
# config/django/settings.py and routed by
# utils.apps.imdbspy.backend.db_router.ImdbspyRouter.
DB_ALIAS = "imdbspy"
APP_LABEL = "imdbspy"

# List pagination.
DEFAULT_PAGE_SIZE = 25
# The legacy Flask app defaulted /api/all to limit=10; kept for the list service.
DEFAULT_LIMIT = 10

# Media item status values (seen / not seen / abandoned).
STATUS_SEEN = "seen"
STATUS_NOT_SEEN = "not_seen"
STATUS_ABANDONED = "abandoned"
STATUSES = (STATUS_SEEN, STATUS_NOT_SEEN, STATUS_ABANDONED)

# Weighted rating scales.
SCALE_FUN = "fun"
SCALE_GRIT = "grit"
SCALE_COMFORT = "comfort"
SCALE_TYPES = (SCALE_FUN, SCALE_GRIT, SCALE_COMFORT)

# Media asset subdirectories under the media root.
MEDIA_ACTORS_DIR = "actors"
MEDIA_TVMOVIE_DIR = "tv-movie"
