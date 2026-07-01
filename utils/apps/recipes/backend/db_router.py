from __future__ import annotations

from utils.apps.recipes.shared.constants import DB_ALIAS

APP_LABEL = "recipes"


class RecipesRouter:
    """Route the recipes app's models to the dedicated SQLite database.

    The recipes tables are ``managed = False`` so no migrations are generated for
    them (the schema is owned by ``backend/services/store.py``), but the router
    still guarantees:

    - recipes model reads/writes go to the ``recipes`` connection, never to
      ``default``;
    - no other app's tables (auth, contenttypes, ...) are created in the recipes
      database.
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
