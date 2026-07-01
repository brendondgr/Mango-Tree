"""DRF views for the timekeeper app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Domain logic lives only in the services.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.timekeeper.backend.api.serializers import paginate, parse_object
from utils.apps.timekeeper.backend.services import categories as categories_service
from utils.apps.timekeeper.backend.services import logs as logs_service
from utils.apps.timekeeper.shared.errors import TimekeeperError

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def _error_response(exc: TimekeeperError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


# --- logs ---------------------------------------------------------------------

class LogListCreateView(APIView):
    def get(self, request: Request) -> Response:
        try:
            date = request.query_params.get("date") or None
            items = [dto.to_dict() for dto in logs_service.list_logs(date=date)]
        except TimekeeperError as exc:
            return _error_response(exc)
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        """Replace a day's logs from painted intervals (body ``{date, intervals}``)."""
        try:
            payload = parse_object(request.data)
            saved = logs_service.save_day(
                payload.get("date"), payload.get("intervals", [])
            )
        except TimekeeperError as exc:
            return _error_response(exc)
        return Response(
            {"date": payload.get("date"), "logs": [dto.to_dict() for dto in saved]},
            status=status.HTTP_200_OK,
        )


class LogDetailView(APIView):
    def put(self, request: Request, log_id: int) -> Response:
        try:
            payload = parse_object(request.data)
            kwargs: dict = {}
            if "start_time" in payload:
                kwargs["start_time"] = payload["start_time"]
            if "duration" in payload:
                kwargs["duration"] = payload["duration"]
            if "notes" in payload:
                if payload["notes"] in (None, ""):
                    kwargs["clear_notes"] = True
                else:
                    kwargs["notes"] = payload["notes"]
            updated = logs_service.update_log(log_id, **kwargs)
        except TimekeeperError as exc:
            return _error_response(exc)
        return Response(updated.to_dict(), status=status.HTTP_200_OK)

    def delete(self, request: Request, log_id: int) -> Response:
        try:
            logs_service.delete_log(log_id)
        except TimekeeperError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- stats --------------------------------------------------------------------

class DailyStatsView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"days": logs_service.daily_totals()})


# --- categories ---------------------------------------------------------------

class CategoriesView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"categories": categories_service.get_categories()})

    def put(self, request: Request) -> Response:
        """Replace the whole taxonomy. Body is a list, or ``{"categories": [...]}``."""
        try:
            data = request.data
            categories = data.get("categories") if isinstance(data, dict) else data
            saved = categories_service.save_categories(categories)
        except TimekeeperError as exc:
            return _error_response(exc)
        return Response({"categories": saved}, status=status.HTTP_200_OK)
