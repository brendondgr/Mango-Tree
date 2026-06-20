from django.urls import include, path

from config.django.views import favicon, health, root_redirect

urlpatterns = [
    path("", root_redirect, name="root"),
    path("favicon.ico", favicon, name="favicon"),
    path("api/health/", health, name="health"),
    path("api/media-viewer/", include("api.routes.media_viewer")),
    path("api/agent/", include("api.routes.agent")),
]
