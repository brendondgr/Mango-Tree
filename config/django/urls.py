from django.urls import include, path

from config.django.views import health

urlpatterns = [
    path("api/health/", health, name="health"),
    path("api/media-viewer/", include("api.routes.media_viewer")),
    path("api/agent/", include("api.routes.agent")),
]
