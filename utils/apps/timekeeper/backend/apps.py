from django.apps import AppConfig


class TimekeeperBackendConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.apps.timekeeper.backend"
    label = "timekeeper"
