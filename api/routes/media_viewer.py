from django.urls import path

from utils.apps.media_viewer.backend.api.views import (
    ArtifactContentView,
    ArtifactDetailView,
    ArtifactListCreateView,
    ArtifactThumbnailView,
)

urlpatterns = [
    path("artifacts/", ArtifactListCreateView.as_view(), name="media-viewer-artifacts"),
    path(
        "artifacts/<uuid:artifact_id>/",
        ArtifactDetailView.as_view(),
        name="media-viewer-artifact-detail",
    ),
    path(
        "artifacts/<uuid:artifact_id>/content/",
        ArtifactContentView.as_view(),
        name="media-viewer-artifact-content",
    ),
    path(
        "artifacts/<uuid:artifact_id>/thumbnail/",
        ArtifactThumbnailView.as_view(),
        name="media-viewer-artifact-thumbnail",
    ),
]
