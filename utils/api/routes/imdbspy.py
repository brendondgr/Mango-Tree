"""IMDbSpy app HTTP routes.

Mounted at ``/api/imdbspy/`` from ``config/django/urls.py``. Views live in
``utils/apps/imdbspy/backend/api/views.py`` and call ``backend/services/`` only
(API <-> agent parity).
"""

from __future__ import annotations

from django.urls import path

from utils.apps.imdbspy.backend.api.views import (
    AssetView,
    MediaAddView,
    MediaDetailView,
    MediaListView,
    MediaRefreshView,
    MediaReviewView,
    MediaSeasonsView,
    MediaStatusView,
    WeightsView,
)

urlpatterns = [
    # Media items (specific subpaths before the <int:item_id> catch-all)
    path("media/", MediaListView.as_view(), name="imdbspy-media-list"),
    path("media/add/", MediaAddView.as_view(), name="imdbspy-media-add"),
    path("media/refresh/", MediaRefreshView.as_view(), name="imdbspy-media-refresh"),
    path("media/<int:item_id>/status/", MediaStatusView.as_view(), name="imdbspy-media-status"),
    path("media/<int:item_id>/review/", MediaReviewView.as_view(), name="imdbspy-media-review"),
    path("media/<int:item_id>/seasons/", MediaSeasonsView.as_view(), name="imdbspy-media-seasons"),
    path("media/<int:item_id>/", MediaDetailView.as_view(), name="imdbspy-media-detail"),

    # Rating weights (config surface)
    path("weights/", WeightsView.as_view(), name="imdbspy-weights"),

    # Cached poster/headshot serving (path is sanitized in the service)
    path("assets/<path:filename>", AssetView.as_view(), name="imdbspy-asset"),
]
