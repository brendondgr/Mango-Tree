"""DRF views for the exercise app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Domain logic lives only in the services.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.exercise.backend.api.serializers import paginate, parse_object
from utils.apps.exercise.backend.services import equipment as equipment_service
from utils.apps.exercise.backend.services import history as history_service
from utils.apps.exercise.backend.services import routines as routine_service
from utils.apps.exercise.backend.services import strava as strava_service
from utils.apps.exercise.backend.services import workouts as workout_service
from utils.apps.exercise.shared.errors import ExerciseError
from utils.apps.exercise.shared.schemas import (
    EquipmentDTO,
    HistoryDTO,
    RoutineDTO,
    WorkoutDTO,
)

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def _error_response(exc: ExerciseError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


# --- workouts -----------------------------------------------------------------

class WorkoutListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [w.to_dict() for w in workout_service.list_workouts()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = WorkoutDTO.from_dict(parse_object(request.data))
            saved = workout_service.save_workout(dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(saved.to_dict(), status=status.HTTP_200_OK)


class WorkoutDetailView(APIView):
    def delete(self, request: Request, workout_id: str) -> Response:
        try:
            workout_service.delete_workout(workout_id)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- routines -----------------------------------------------------------------

class RoutineListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [r.to_dict() for r in routine_service.list_routines()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = RoutineDTO.from_dict(parse_object(request.data))
            saved = routine_service.save_routine(dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(saved.to_dict(), status=status.HTTP_200_OK)


class RoutineDetailView(APIView):
    def delete(self, request: Request, routine_id: str) -> Response:
        try:
            routine_service.delete_routine(routine_id)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- equipment ----------------------------------------------------------------

class EquipmentListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [e.to_dict() for e in equipment_service.list_equipment()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = EquipmentDTO.from_dict(parse_object(request.data))
            created = equipment_service.add_equipment(dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(created.to_dict(), status=status.HTTP_201_CREATED)


class EquipmentDetailView(APIView):
    def put(self, request: Request, equip_id: str) -> Response:
        try:
            dto = EquipmentDTO.from_dict(parse_object(request.data))
            updated = equipment_service.update_equipment(equip_id, dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(updated.to_dict(), status=status.HTTP_200_OK)

    def delete(self, request: Request, equip_id: str) -> Response:
        try:
            equipment_service.delete_equipment(equip_id)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- history ------------------------------------------------------------------

class HistoryListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [h.to_dict() for h in history_service.list_history()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = HistoryDTO.from_dict(parse_object(request.data))
            created = history_service.add_log(dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(created.to_dict(), status=status.HTTP_201_CREATED)


class HistoryDetailView(APIView):
    def put(self, request: Request, log_id: str) -> Response:
        try:
            dto = HistoryDTO.from_dict(parse_object(request.data))
            updated = history_service.update_log(log_id, dto)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(updated.to_dict(), status=status.HTTP_200_OK)

    def delete(self, request: Request, log_id: str) -> Response:
        try:
            history_service.delete_log(log_id)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- strava -------------------------------------------------------------------

class StravaSyncView(APIView):
    def post(self, request: Request) -> Response:
        period = request.data.get("period", "week") if isinstance(request.data, dict) else "week"
        try:
            summary = strava_service.sync_strava(period)
        except ExerciseError as exc:
            return _error_response(exc)
        return Response(summary, status=status.HTTP_200_OK)
