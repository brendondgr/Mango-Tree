"""Calendar tools (12): reads, reversible writes, confirm-gated deletes."""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "calendar"]


def _direct_titles(sb):
    from utils.apps.calendar.backend.services.calendar import load_calendar
    return [e["title"] for e in load_calendar().get("direct_events", [])]


def _entries(sb):
    from utils.apps.calendar.backend.services.calendar import load_calendar
    return load_calendar().get("entries", [])


SCENARIOS = [
    h.Scenario(
        id="calendar.tomorrow",
        title="What is on tomorrow",
        groups=G,
        prompt="What do I have on tomorrow?",
        notes="A relative date resolves to one get_day call; the merged view carries schedule + direct events.",
        turns=[
            h.calls(h.dynamic("calendar_get_day", "'tomorrow' is a single date -> get_day",
                              lambda ctx: {"date": ctx.sandbox.tomorrow},
                              check=lambda r: _assert(any(e["title"] == "Scenario Dentist" for e in r["events"])))),
            h.answer("Tomorrow you have Scenario Dentist at 10:00 and Scenario Standup at 14:00."),
        ],
        live=h.LiveExpectation(required=[], forbidden=["calendar_delete_direct_event", "calendar_delete_event_by_title"],
                               answer_any=["dentist"]),
    ),
    h.Scenario(
        id="calendar.week_and_range",
        title="This week, and a specific range",
        groups=G,
        prompt="Show me this week's events, and everything between 2026-02-10 and 2026-02-16.",
        turns=[
            h.calls(
                h.call("calendar_get_week", "no date -> the current week"),
                h.call("calendar_get_range", "explicit inclusive range", start="2026-02-10", end="2026-02-16",
                       check=lambda r: _assert(isinstance(r, dict) and r)),
            ),
            h.answer("This week's events and the February range are listed above."),
        ],
        live=h.LiveExpectation(required=["calendar_get_week", "calendar_get_range"]),
    ),
    h.Scenario(
        id="calendar.free_slots",
        title="Suggest a meeting time",
        groups=G,
        prompt="Find me a free hour tomorrow afternoon, between 12:00 and 18:00.",
        turns=[
            h.calls(h.dynamic("calendar_find_free_slots", "meeting-time questions use the gap finder with the window given",
                              lambda ctx: {"date": ctx.sandbox.tomorrow, "min_duration_minutes": 60,
                                           "start_after": "12:00", "end_before": "18:00"},
                              check=lambda r: _assert("free_slots" in r))),
            h.answer("The free slots tomorrow afternoon are listed above; 14:30-18:00 is open after the standup."),
        ],
        live=h.LiveExpectation(required=["calendar_find_free_slots"]),
    ),
    h.Scenario(
        id="calendar.upcoming_health",
        title="Upcoming events filtered by type",
        groups=G,
        prompt="Any health appointments coming up in the next week?",
        turns=[
            h.calls(h.call("calendar_list_upcoming", "upcoming direct events with a type filter",
                           days_ahead=7, type_filter="health",
                           check=lambda r: _assert([e["title"] for e in r["events"]] == ["Scenario Dentist"]))),
            h.answer("One: Scenario Dentist tomorrow at 10:00."),
        ],
        live=h.LiveExpectation(required=["calendar_list_upcoming"], answer_any=["dentist"]),
    ),
    h.Scenario(
        id="calendar.add_then_move",
        title="Add an event, then move it",
        groups=G,
        prompt="Add 'Scenario Haircut' tomorrow 16:00-16:30, then move it to 17:00-17:30.",
        notes="update_direct_event needs the index add returned; both writes are reversible so neither is gated.",
        turns=[
            h.calls(h.dynamic("calendar_add_direct_event", "one-off event -> direct event",
                              lambda ctx: {"date": ctx.sandbox.tomorrow, "title": "Scenario Haircut",
                                           "start": "16:00", "end": "16:30", "type": "personal"})),
            h.calls(h.dynamic("calendar_update_direct_event", "replace at the returned index with the new times",
                              lambda ctx: {"index": ctx.result("calendar_add_direct_event")["index"],
                                           "date": ctx.sandbox.tomorrow, "title": "Scenario Haircut",
                                           "start": "17:00", "end": "17:30", "type": "personal"},
                              check=lambda r: _assert(r["updated"] is True))),
            h.answer("Added the haircut and moved it to 17:00."),
        ],
        live=h.LiveExpectation(required=["calendar_add_direct_event", "calendar_update_direct_event"],
                               order=[("calendar_add_direct_event", "calendar_update_direct_event")],
                               forbidden=["calendar_delete_direct_event"]),
        verify=lambda sb: _assert(_direct_titles(sb).count("Scenario Haircut") == 1),
    ),
    h.Scenario(
        id="calendar.map_schedule",
        title="Map a weekly schedule onto a date range, then hit the overlap conflict",
        groups=G,
        prompt="Use the summer_2026 schedule from 2026-10-01 to 2026-12-15. Also try spring_2026 for 2026-02-01 to 2026-02-28.",
        turns=[
            h.calls(h.call("calendar_list_schedules", "schedule filenames must come from the list, not be guessed",
                           check=lambda r: _assert("summer_2026.json" in r["schedules"]))),
            h.calls(
                h.call("calendar_add_entry", "non-overlapping range -> new entry",
                       start_date="2026-10-01", end_date="2026-12-15", schedule_filename="summer_2026.json"),
                h.call("calendar_add_entry", "overlaps the seeded spring entry -> conflict",
                       start_date="2026-02-01", end_date="2026-02-28", schedule_filename="spring_2026.json",
                       expect=h.error("conflict")),
            ),
            h.answer("Mapped summer_2026 to Oct 1 - Dec 15; the February range overlaps an existing mapping."),
        ],
        live=h.LiveExpectation(required=["calendar_add_entry"], order=[("calendar_list_schedules", "calendar_add_entry")]),
        verify=lambda sb: _assert(any(e["schedule_filename"] == "summer_2026.json" for e in _entries(sb))),
    ),
    h.Scenario(
        id="calendar.delete_requires_confirm",
        title="Deletes without approval are refused (all three gated tools)",
        groups=G,
        prompt="Delete tomorrow's dentist appointment and remove the spring schedule mapping.",
        turns=[
            h.calls(h.call("calendar_list_upcoming", "find the event and its _direct_index", days_ahead=2)),
            h.calls(
                h.dynamic("calendar_delete_direct_event", "no approval -> no confirm",
                          lambda ctx: {"index": find(ctx.result("calendar_list_upcoming")["events"],
                                                     title="Scenario Dentist")["_direct_index"]},
                          expect=h.DENIED_CONFIRM),
                h.dynamic("calendar_delete_event_by_title", "no approval -> no confirm",
                          lambda ctx: {"date": ctx.sandbox.tomorrow, "title": "Dentist"}, expect=h.DENIED_CONFIRM),
                h.call("calendar_delete_entry", "no approval -> no confirm", index=0, expect=h.DENIED_CONFIRM),
            ),
            h.answer("Both deletions are permanent. Shall I go ahead?"),
        ],
        live=h.LiveExpectation(answer_any=["confirm", "sure", "permanent", "go ahead", "delete"]),
        verify=lambda sb: _assert("Scenario Dentist" in _direct_titles(sb) and len(_entries(sb)) >= 1,
                                  "something was deleted without approval"),
    ),
    h.Scenario(
        id="calendar.delete_after_approval",
        title="Delete by title and by index after approval",
        groups=G,
        history=approved("Delete tomorrow's dentist appointment and the standup.",
                         "Both are permanent. Delete them?"),
        prompt="Yes, delete both.",
        notes="Positions shift on delete, so the second delete goes by title rather than a stale index.",
        turns=[
            h.calls(h.call("calendar_list_upcoming", "find the indices", days_ahead=2)),
            h.calls(h.dynamic("calendar_delete_direct_event", "approved -> confirm: true",
                              lambda ctx: {"index": find(ctx.result("calendar_list_upcoming")["events"],
                                                         title="Scenario Standup")["_direct_index"], "confirm": True})),
            h.calls(h.dynamic("calendar_delete_event_by_title", "indices shifted after the delete; match by title instead",
                              lambda ctx: {"date": ctx.sandbox.tomorrow, "title": "Dentist", "confirm": True},
                              check=lambda r: _assert(r["deleted"] is True))),
            h.answer("Deleted the standup and the dentist appointment."),
        ],
        live=h.LiveExpectation(required=["calendar_list_upcoming"], max_calls=8),
        verify=lambda sb: _assert("Scenario Dentist" not in _direct_titles(sb)
                                  and "Scenario Standup" not in _direct_titles(sb), "events survived the delete"),
    ),
    h.Scenario(
        id="calendar.unmap_after_approval",
        title="Remove a schedule mapping after approval",
        groups=G,
        history=approved("Remove the spring_2026 schedule mapping.", "That removes the mapping permanently. Go ahead?"),
        prompt="Yes.",
        turns=[
            h.calls(h.call("calendar_delete_entry", "approved -> confirm: true; the seeded mapping is index 0",
                           index=0, confirm=True)),
            h.answer("Removed the spring_2026 mapping."),
        ],
        live=h.LiveExpectation(required=["calendar_delete_entry"]),
        verify=lambda sb: _assert(not any(e["schedule_filename"] == "spring_2026.json" for e in _entries(sb))),
    ),
    h.Scenario(
        id="calendar.validation",
        title="An event ending before it starts is a validation_error",
        groups=G,
        prompt="Add 'Backwards' tomorrow from 11:00 to 10:00.",
        turns=[
            h.calls(h.dynamic("calendar_add_direct_event", "start must precede end",
                              lambda ctx: {"date": ctx.sandbox.tomorrow, "title": "Backwards", "start": "11:00", "end": "10:00"},
                              expect=h.error("validation_error"))),
            h.answer("The end time is before the start time; did you mean 10:00-11:00?"),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
