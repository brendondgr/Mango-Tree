"""DRF views for the calendar app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). No domain logic lives here.
"""

from __future__ import annotations

import json

from django.http import HttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.calendar.backend.api.serializers import (
    error_response,
    parse_object,
)
from utils.apps.calendar.backend.services import calendar as calendar_service
from utils.apps.calendar.backend.services import schedules as schedules_service
from utils.apps.calendar.shared.errors import CalendarError, ValidationError


def _int(value, default: int, *, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


# --- Schedules ---------------------------------------------------------------

class SchedulesView(APIView):
    def get(self, request: Request) -> Response:
        names = schedules_service.list_schedules()
        return Response({"schedules": names, "count": len(names)})

    def post(self, request: Request) -> Response:
        try:
            upload = request.FILES.get("file")
            if upload is not None:
                filename = upload.name
                data = json.loads(upload.read().decode("utf-8"))
                actual = data
            else:
                body = parse_object(request.data)
                filename = body.get("filename", "new_schedule.json")
                actual = body["data"] if "data" in body else body
            saved = schedules_service.save_schedule(filename, actual)
        except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as exc:
            return error_response(ValidationError(f"Invalid schedule payload: {exc}"))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Schedule saved", "filename": saved}, status=status.HTTP_201_CREATED)


class ScheduleDetailView(APIView):
    def get(self, request: Request, filename: str) -> Response:
        try:
            return Response(schedules_service.get_schedule_detail(filename))
        except CalendarError as exc:
            return error_response(exc)

    def delete(self, request: Request, filename: str) -> Response:
        try:
            removed = schedules_service.delete_schedule(filename)
        except CalendarError as exc:
            return error_response(exc)
        return Response({"success": True, "message": "Schedule deleted", "removed_mappings": removed})


class ScheduleColorMappingsView(APIView):
    def put(self, request: Request, filename: str) -> Response:
        try:
            mappings = parse_object(request.data)
            schedules_service.update_color_mappings(filename, mappings)
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Color mappings updated"})


class ScheduleCategoryRenameView(APIView):
    def post(self, request: Request, filename: str) -> Response:
        try:
            body = parse_object(request.data)
            updated = schedules_service.rename_category(
                filename, body.get("old"), body.get("new")
            )
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Category renamed", "updated": updated})


class ScheduleEventsView(APIView):
    def post(self, request: Request, filename: str) -> Response:
        try:
            index = schedules_service.add_event(filename, parse_object(request.data))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Event added", "index": index}, status=status.HTTP_201_CREATED)


class ScheduleEventDetailView(APIView):
    def put(self, request: Request, filename: str, index: int) -> Response:
        try:
            schedules_service.update_event(filename, index, parse_object(request.data))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Event updated"})

    def delete(self, request: Request, filename: str, index: int) -> Response:
        try:
            schedules_service.delete_event(filename, index)
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Event deleted"})


class SchedulePrintView(APIView):
    def post(self, request: Request, filename: str) -> HttpResponse | Response:
        from utils.apps.calendar.backend.services import pdf as pdf_service
        from utils.apps.calendar.shared import colors as colors_module

        try:
            body = parse_object(request.data)
            time_range = body.get("timeRange", {}) or {}
            view_state = {
                "startHour": time_range.get("startHour") if time_range.get("startHour") is not None else 0,
                "endHour": time_range.get("endHour") if time_range.get("endHour") is not None else 24,
                "daysRange": body.get("daysRange"),
            }
            hidden_categories = body.get("hiddenCategories", [])

            schedule_data = schedules_service.load_schedule(filename)
            events = schedule_data.get("events", [])
            unique_types = list({e.get("type", "other") for e in events})
            color_scheme = colors_module.generate_color_palette(
                unique_types, schedule_data.get("color_mappings", {})
            )

            buffer = pdf_service.generate_schedule_pdf(
                schedule_data=schedule_data,
                events=events,
                color_scheme=color_scheme,
                view_state=view_state,
                hidden_categories=hidden_categories,
            )
        except CalendarError as exc:
            return error_response(exc)

        schedule_name = schedule_data.get("name", filename.replace(".json", ""))
        safe = "".join(c for c in schedule_name if c.isalnum() or c in (" ", "-", "_")).rstrip()
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{safe}.pdf"'
        return response


# --- Colors / instructions ---------------------------------------------------

class ColorsView(APIView):
    def get(self, request: Request) -> Response:
        return Response(schedules_service.predefined_colors())


class InstructionsView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"content": schedules_service.load_instructions()})


# --- Calendar config + merged views ------------------------------------------

class CalendarConfigView(APIView):
    def get(self, request: Request) -> Response:
        try:
            return Response(calendar_service.load_calendar())
        except CalendarError as exc:
            return error_response(exc)


class CalendarDateView(APIView):
    def get(self, request: Request, date: str) -> Response:
        try:
            return Response(calendar_service.day_view(date))
        except CalendarError as exc:
            return error_response(exc)


class CalendarWeekView(APIView):
    def get(self, request: Request) -> Response:
        try:
            return Response(calendar_service.week_view(request.query_params.get("date")))
        except CalendarError as exc:
            return error_response(exc)


class CalendarRangeView(APIView):
    def get(self, request: Request) -> Response:
        try:
            return Response(calendar_service.range_view(
                request.query_params.get("start"), request.query_params.get("end")
            ))
        except CalendarError as exc:
            return error_response(exc)


# --- Calendar entries --------------------------------------------------------

class CalendarEntriesView(APIView):
    def post(self, request: Request) -> Response:
        try:
            body = parse_object(request.data)
            index = calendar_service.add_calendar_entry(
                body.get("start_date"), body.get("end_date"), body.get("schedule_filename")
            )
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Calendar entry added", "index": index}, status=status.HTTP_201_CREATED)


class CalendarEntryDetailView(APIView):
    def put(self, request: Request, index: int) -> Response:
        try:
            body = parse_object(request.data)
            calendar_service.update_calendar_entry(
                index, body.get("start_date"), body.get("end_date"), body.get("schedule_filename")
            )
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Calendar entry updated"})

    def delete(self, request: Request, index: int) -> Response:
        try:
            calendar_service.delete_calendar_entry(index)
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Calendar entry deleted"})


# --- Direct events -----------------------------------------------------------

class CalendarEventsView(APIView):
    def post(self, request: Request) -> Response:
        try:
            index = calendar_service.add_direct_event(parse_object(request.data))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Direct event added", "index": index}, status=status.HTTP_201_CREATED)


class CalendarEventDetailView(APIView):
    def put(self, request: Request, index: int) -> Response:
        try:
            calendar_service.update_direct_event(index, parse_object(request.data))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Direct event updated"})

    def delete(self, request: Request, index: int) -> Response:
        try:
            calendar_service.delete_direct_event(index)
        except CalendarError as exc:
            return error_response(exc)
        return Response({"message": "Direct event deleted"})


class CalendarDeleteByTitleView(APIView):
    def post(self, request: Request) -> Response:
        try:
            body = parse_object(request.data)
            result = calendar_service.delete_event_by_title(body.get("date"), body.get("title"))
        except CalendarError as exc:
            return error_response(exc)
        return Response({"success": True, **result})


# --- Agent-flavored helpers --------------------------------------------------

class CalendarFreeSlotsView(APIView):
    def get(self, request: Request) -> Response:
        date = request.query_params.get("date")
        if not date:
            return error_response(ValidationError("date parameter required"))
        try:
            result = calendar_service.free_slots(
                date,
                min_duration_minutes=_int(request.query_params.get("min_duration_minutes"), 30, lo=1, hi=1440),
                start_after=request.query_params.get("start_after", "08:00"),
                end_before=request.query_params.get("end_before", "22:00"),
            )
        except CalendarError as exc:
            return error_response(exc)
        return Response(result)


class CalendarUpcomingView(APIView):
    def get(self, request: Request) -> Response:
        try:
            result = calendar_service.upcoming(
                days_ahead=_int(request.query_params.get("days_ahead"), 14, lo=1, hi=365),
                type_filter=request.query_params.get("type_filter"),
            )
        except CalendarError as exc:
            return error_response(exc)
        return Response(result)
