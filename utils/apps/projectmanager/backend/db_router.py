from __future__ import annotations

from utils.apps.projectmanager.shared.constants import DB_ALIAS

APP_LABEL = "projectmanager"


class ProjectManagerRouter:
    """Route the projectmanager app's models to the dedicated legacy SQLite DB.

    The projectmanager tables are ``managed = False`` so no migrations are
    generated for them, but the router still guarantees:

    - projectmanager model reads/writes go to the ``projectmanager`` connection,
      never to ``default``;
    - no other app's tables (auth, contenttypes, ...) are created in the legacy
      project-manager database.
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
