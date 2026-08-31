from django.apps import AppConfig


class MangoLlmConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "utils.shared.llm"
    # ``llm`` is short enough to collide with a future third-party app, and the
    # label is what migration state keys off, so it is namespaced. Models here
    # live on the ``default`` database.
    label = "mango_llm"
