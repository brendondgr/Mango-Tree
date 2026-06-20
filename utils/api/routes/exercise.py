"""Route module for the exercise app, mounted at ``/api/exercise/`` in
config/django/urls.py. Views call backend/services/ only."""

from django.urls import path

from utils.apps.exercise.backend.api.views import (
    EquipmentDetailView,
    EquipmentListCreateView,
    HistoryDetailView,
    HistoryListCreateView,
    RoutineDetailView,
    RoutineListCreateView,
    WorkoutDetailView,
    WorkoutListCreateView,
)

urlpatterns = [
    path("workouts/", WorkoutListCreateView.as_view(), name="exercise-workouts"),
    path("workouts/<str:workout_id>/", WorkoutDetailView.as_view(), name="exercise-workout-detail"),
    path("routines/", RoutineListCreateView.as_view(), name="exercise-routines"),
    path("routines/<str:routine_id>/", RoutineDetailView.as_view(), name="exercise-routine-detail"),
    path("equipment/", EquipmentListCreateView.as_view(), name="exercise-equipment"),
    path("equipment/<str:equip_id>/", EquipmentDetailView.as_view(), name="exercise-equipment-detail"),
    path("history/", HistoryListCreateView.as_view(), name="exercise-history"),
    path("history/<str:log_id>/", HistoryDetailView.as_view(), name="exercise-history-detail"),
]
