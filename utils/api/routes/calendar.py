"""Calendar app HTTP routes.

Mounted at ``/api/calendar/`` from ``config/django/urls.py``. Views live in
``utils/apps/calendar/backend/api/views.py`` and call ``backend/services/`` only.
"""

from django.urls import path

from utils.apps.calendar.backend.api.views import (
    CalendarConfigView,
    CalendarDateView,
    CalendarDeleteByTitleView,
    CalendarEntriesView,
    CalendarEntryDetailView,
    CalendarEventDetailView,
    CalendarEventsView,
    CalendarFreeSlotsView,
    CalendarRangeView,
    CalendarUpcomingView,
    CalendarWeekView,
    ColorsView,
    InstructionsView,
    ScheduleColorMappingsView,
    ScheduleDetailView,
    ScheduleEventDetailView,
    ScheduleEventsView,
    SchedulePrintView,
    SchedulesView,
)

urlpatterns = [
    # Schedules (specific subpaths before the <filename> catch-all)
    path("schedules/", SchedulesView.as_view(), name="calendar-schedules"),
    path("schedules/<str:filename>/color-mappings/", ScheduleColorMappingsView.as_view(), name="calendar-schedule-colors"),
    path("schedules/<str:filename>/events/", ScheduleEventsView.as_view(), name="calendar-schedule-events"),
    path("schedules/<str:filename>/events/<int:index>/", ScheduleEventDetailView.as_view(), name="calendar-schedule-event-detail"),
    path("schedules/<str:filename>/print/", SchedulePrintView.as_view(), name="calendar-schedule-print"),
    path("schedules/<str:filename>/", ScheduleDetailView.as_view(), name="calendar-schedule-detail"),

    # Palette + instructions
    path("colors/", ColorsView.as_view(), name="calendar-colors"),
    path("instructions/", InstructionsView.as_view(), name="calendar-instructions"),

    # Calendar config + merged views
    path("config/", CalendarConfigView.as_view(), name="calendar-config"),
    path("date/<str:date>/", CalendarDateView.as_view(), name="calendar-date"),
    path("week/", CalendarWeekView.as_view(), name="calendar-week"),
    path("range/", CalendarRangeView.as_view(), name="calendar-range"),

    # Schedule-to-date entries
    path("entries/", CalendarEntriesView.as_view(), name="calendar-entries"),
    path("entries/<int:index>/", CalendarEntryDetailView.as_view(), name="calendar-entry-detail"),

    # Direct events (delete-by-title before the <int> detail route)
    path("events/delete-by-title/", CalendarDeleteByTitleView.as_view(), name="calendar-event-delete-by-title"),
    path("events/", CalendarEventsView.as_view(), name="calendar-events"),
    path("events/<int:index>/", CalendarEventDetailView.as_view(), name="calendar-event-detail"),

    # Agent-flavored helpers
    path("free-slots/", CalendarFreeSlotsView.as_view(), name="calendar-free-slots"),
    path("upcoming/", CalendarUpcomingView.as_view(), name="calendar-upcoming"),
]
