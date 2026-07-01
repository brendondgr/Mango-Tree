from django.apps import AppConfig


class RecipesBackendConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.apps.recipes.backend"
    label = "recipes"
