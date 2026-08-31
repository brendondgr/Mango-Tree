"""Route module for the LLM provider API, mounted at ``/api/llm/`` in
config/django/urls.py. Views call utils/shared/llm/services only."""

from django.urls import path

from utils.shared.llm.api.views import (
    kinds,
    models,
    provider_collection,
    provider_detail,
    test,
)

urlpatterns = [
    path("kinds/", kinds, name="llm-kinds"),
    path("providers/", provider_collection, name="llm-providers"),
    path("providers/<slug:slug>/", provider_detail, name="llm-provider-detail"),
    path("models/", models, name="llm-models"),
    path("test/", test, name="llm-test"),
]
