from __future__ import annotations

from django.apps import AppConfig


class ImdbspyBackendConfig(AppConfig):
    """Django app config for the IMDbSpy media tracker.

    Models are managed (Django owns the schema) and routed to a dedicated
    ``imdbspy`` SQLite connection by
    ``utils.apps.imdbspy.backend.db_router.ImdbspyRouter`` — see
    ``config/django/settings.py``.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.apps.imdbspy.backend"
    label = "imdbspy"
