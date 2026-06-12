from django.urls import include, path

urlpatterns = [
    path("api/media-viewer/", include("api.routes.media_viewer")),
]
