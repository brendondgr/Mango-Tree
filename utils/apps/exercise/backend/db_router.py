from __future__ import annotations

from utils.apps.exercise.shared.constants import DB_ALIAS

APP_LABEL = "exercise"


class ExerciseRouter:
    """Route the exercise app's models to the dedicated legacy SQLite database.

    The exercise tables are ``managed = False`` so no migrations are generated
    for them, but the router still guarantees:

    - exercise model reads/writes go to the ``exercise`` connection, never to
      ``default``;
    - no other app's tables (auth, contenttypes, ...) are created in the
      legacy workout database.
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
