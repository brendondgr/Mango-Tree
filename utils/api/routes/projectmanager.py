"""Route module for the projectmanager app, mounted at ``/api/projectmanager/`` in
config/django/urls.py. Views call backend/services/ only."""

from django.urls import path

from utils.apps.projectmanager.backend.api.views import (
    CategoryListView,
    GoalDeadlinesView,
    GoalDetailView,
    GoalToggleView,
    ProjectDetailView,
    ProjectGoalsView,
    ProjectListCreateView,
    TimelineDashboardView,
    TimelineProjectView,
)

urlpatterns = [
    path("projects/", ProjectListCreateView.as_view(), name="projectmanager-projects"),
    path("projects/<int:project_id>/", ProjectDetailView.as_view(), name="projectmanager-project-detail"),
    path("projects/<int:project_id>/goals/", ProjectGoalsView.as_view(), name="projectmanager-project-goals"),
    path("goals/deadlines/", GoalDeadlinesView.as_view(), name="projectmanager-goal-deadlines"),
    path("goals/<int:goal_id>/", GoalDetailView.as_view(), name="projectmanager-goal-detail"),
    path("goals/<int:goal_id>/toggle/", GoalToggleView.as_view(), name="projectmanager-goal-toggle"),
    path("categories/", CategoryListView.as_view(), name="projectmanager-categories"),
    path("timeline/dashboard/", TimelineDashboardView.as_view(), name="projectmanager-timeline-dashboard"),
    path("timeline/project/<int:project_id>/", TimelineProjectView.as_view(), name="projectmanager-timeline-project"),
]
