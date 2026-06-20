from django.apps import AppConfig
from django.db.backends.signals import connection_created


def _disable_foreign_keys_for_exercise(sender, connection, **kwargs):
    """The legacy WorkoutTracker ran SQLite with foreign-key enforcement OFF
    (the default), so 873/901 history rows reference synthetic ``run``/``walk``
    workout IDs that are not in the ``workouts`` table. Django enables
    ``PRAGMA foreign_keys = ON`` per connection; turn it back OFF for the
    exercise database so the preserved data and new run/walk + Strava logs keep
    working exactly as before.
    """
    if connection.alias == "exercise" and connection.vendor == "sqlite":
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA foreign_keys = OFF;")


class ExerciseBackendConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.apps.exercise.backend"
    label = "exercise"

    def ready(self) -> None:
        connection_created.connect(_disable_foreign_keys_for_exercise)
