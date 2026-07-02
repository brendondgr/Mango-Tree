from django.apps import AppConfig


class MangoAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.shared.auth"
    # ``auth`` is taken by django.contrib.auth, so use a distinct label. Models
    # in this app live on the ``default`` database.
    label = "mango_auth"
