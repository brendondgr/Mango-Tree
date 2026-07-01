"""Route module for the timekeeper app, mounted at ``/api/timekeeper/`` in
config/django/urls.py. Views call backend/services/ only."""

from django.urls import path

from utils.apps.timekeeper.backend.api.views import (
    CategoriesView,
    DailyStatsView,
    LogDetailView,
    LogListCreateView,
)

urlpatterns = [
    path("logs/", LogListCreateView.as_view(), name="timekeeper-logs"),
    path("logs/<int:log_id>/", LogDetailView.as_view(), name="timekeeper-log-detail"),
    path("stats/daily/", DailyStatsView.as_view(), name="timekeeper-stats-daily"),
    path("categories/", CategoriesView.as_view(), name="timekeeper-categories"),
]
