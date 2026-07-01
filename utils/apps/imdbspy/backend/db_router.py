from __future__ import annotations

from utils.apps.imdbspy.shared.constants import DB_ALIAS

APP_LABEL = "imdbspy"


class ImdbspyRouter:
    """Route the IMDbSpy models to their dedicated SQLite database.

    Unlike the exercise/projectmanager routers (which bind ``managed = False``
    to legacy files), IMDbSpy owns its schema: ``allow_migrate`` returns True for
    the ``imdbspy`` app on the ``imdbspy`` connection so ``migrate --database=
    imdbspy`` creates the tables there — and nowhere else.
    """

    def db_for_read(self, model, **hints):
        if model._meta.app_label == APP_LABEL:
            return DB_ALIAS
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == APP_LABEL:
            return DB_ALIAS
        return None

    def allow_relation(self, obj1, obj2, **hints):
        labels = {obj1._meta.app_label, obj2._meta.app_label}
        if labels == {APP_LABEL}:
            return True
        if APP_LABEL in labels:
            return False
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == APP_LABEL:
            return db == DB_ALIAS
        if db == DB_ALIAS:
            return False
        return None
