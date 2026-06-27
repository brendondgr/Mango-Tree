"""DRF views for the projectmanager app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Domain logic lives only in the services.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.projectmanager.backend.api.serializers import paginate, parse_object
from utils.apps.projectmanager.backend.services import categories as categories_service
from utils.apps.projectmanager.backend.services import goals as goals_service
from utils.apps.projectmanager.backend.services import projects as projects_service
from utils.apps.projectmanager.backend.services import timeline as timeline_service
from utils.apps.projectmanager.shared.errors import ProjectManagerError, ValidationError
from utils.apps.projectmanager.shared.schemas import NewGoalDTO, NewProjectDTO

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def _error_response(exc: ProjectManagerError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


# --- projects -----------------------------------------------------------------

class ProjectListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [p.to_dict() for p in projects_service.list_projects()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = NewProjectDTO.from_dict(parse_object(request.data))
            created = projects_service.create_project(dto)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(created.to_dict(), status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    def get(self, request: Request, project_id: int) -> Response:
        try:
            project = projects_service.get_project(project_id)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(project.to_dict())

    def patch(self, request: Request, project_id: int) -> Response:
        try:
            payload = parse_object(request.data)
            status_val = payload.get("status")
            updated = projects_service.update_status(project_id, status_val)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(updated.to_dict(), status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: int) -> Response:
        try:
            projects_service.delete_project(project_id)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- project goals ------------------------------------------------------------

class ProjectGoalsView(APIView):
    def get(self, request: Request, project_id: int) -> Response:
        try:
            items = [g.to_dict() for g in goals_service.list_goals_for_project(project_id)]
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(paginate(request, items))

    def post(self, request: Request, project_id: int) -> Response:
        try:
            payload = parse_object(request.data)
            goals_list = payload.get("goals")
            if not isinstance(goals_list, list):
                raise ValidationError("'goals' must be a list", details={"field": "goals"})
            dtos = [NewGoalDTO.from_dict(g) for g in goals_list]
            created = goals_service.create_goals(project_id, dtos)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response({"goals": [g.to_dict() for g in created]}, status=status.HTTP_201_CREATED)


# --- goals --------------------------------------------------------------------

class GoalDeadlinesView(APIView):
    def get(self, request: Request) -> Response:
        items = [g.to_dict() for g in goals_service.list_goals_with_deadlines()]
        return Response(paginate(request, items))


class GoalDetailView(APIView):
    def patch(self, request: Request, goal_id: int) -> Response:
        try:
            payload = parse_object(request.data)
            title = payload.get("title")
            deadline = None
            clear_deadline = False
            if "deadline" in payload:
                if not payload["deadline"]:
                    clear_deadline = True
                    deadline = None
                else:
                    # Use NewGoalDTO.from_dict to parse and validate the deadline string.
                    parsed_dto = NewGoalDTO.from_dict({"title": title or "x", "deadline": payload["deadline"]})
                    deadline = parsed_dto.deadline
            updated = goals_service.update_goal(goal_id, title=title, deadline=deadline, clear_deadline=clear_deadline)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(updated.to_dict(), status=status.HTTP_200_OK)

    def delete(self, request: Request, goal_id: int) -> Response:
        try:
            goals_service.delete_goal(goal_id)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoalToggleView(APIView):
    def post(self, request: Request, goal_id: int) -> Response:
        try:
            toggled = goals_service.toggle_goal(goal_id)
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(toggled.to_dict(), status=status.HTTP_200_OK)


# --- categories ---------------------------------------------------------------

class CategoryListView(APIView):
    def get(self, request: Request) -> Response:
        items = [c.to_dict() for c in categories_service.list_categories()]
        return Response(paginate(request, items))


# --- timeline -----------------------------------------------------------------

class TimelineDashboardView(APIView):
    def get(self, request: Request) -> Response:
        raw_status = request.query_params.get("status")
        status_list = [s.strip() for s in raw_status.split(",") if s.strip()] if raw_status else None
        item_type = request.query_params.get("type") or None
        raw_project_id = request.query_params.get("project_id")
        project_id = None
        if raw_project_id is not None:
            try:
                project_id = int(raw_project_id)
            except (TypeError, ValueError):
                project_id = None
        start_date = request.query_params.get("start_date") or None
        end_date = request.query_params.get("end_date") or None
        try:
            result = timeline_service.dashboard_timeline(
                status=status_list,
                item_type=item_type,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date,
            )
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(result, status=status.HTTP_200_OK)


class TimelineProjectView(APIView):
    def get(self, request: Request, project_id: int) -> Response:
        raw_status = request.query_params.get("status")
        status_list = [s.strip() for s in raw_status.split(",") if s.strip()] if raw_status else None
        start_date = request.query_params.get("start_date") or None
        end_date = request.query_params.get("end_date") or None
        try:
            result = timeline_service.project_timeline(
                project_id,
                status=status_list,
                start_date=start_date,
                end_date=end_date,
            )
        except ProjectManagerError as exc:
            return _error_response(exc)
        return Response(result, status=status.HTTP_200_OK)
