"""Mixed scenarios: one request that needs tools from two or more apps.

These prove the ordering across apps — a read in one app feeding a write in
another — and that enabling several groups at once offers exactly their union.
"""

from __future__ import annotations

import base64
from datetime import date, timedelta

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find


def _next_weekday(today: str, weekday: int) -> str:
    d = date.fromisoformat(today)
    delta = (weekday - d.weekday()) % 7 or 7
    return (d + timedelta(days=delta)).isoformat()


def _direct_titles(sb):
    from utils.apps.calendar.backend.services.calendar import load_calendar
    return [e["title"] for e in load_calendar().get("direct_events", [])]


def _imdb_status(sb, title):
    from utils.apps.imdbspy.backend.models import MediaItem
    return MediaItem.objects.get(title=title).status


def _day_minutes(sb, day):
    from utils.apps.timekeeper.backend.services import logs
    return sum(dto.duration for dto in logs.list_logs(date=day))


def _block_index(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")
    return int(hours) * 12 + int(minutes) // 5


SCENARIOS = [
    h.Scenario(
        id="mixed.workout_then_abandon_show",
        title="Exercise + IMDbSpy: log a session, then change a show's status",
        groups=["core", "exercise", "imdbspy"],
        prompt=("Log my Scenario Push Day session for 2026-09-08 (45 minutes, 4800 volume), "
                "and mark Severance as abandoned — I gave up on it."),
        notes="Two apps in one request: the independent write and read go out together, the dependent write follows.",
        turns=[
            h.calls(
                h.call("exercise_log_workout", "independent of the movie tracker; write it now",
                       log={"id": "scn_push_0908", "workout_id": "scn_push", "date": "2026-09-08",
                            "duration": 2700, "volume": 4800, "exercises": []}),
                h.call("imdbspy_list_media", "need Severance's integer id before changing its status", search="severance"),
            ),
            h.calls(h.dynamic("imdbspy_set_status", "id from the read; status 'abandoned' per the user",
                              lambda ctx: {"item_id": find(ctx.result("imdbspy_list_media")["items"], title="Severance")["id"],
                                           "status": "abandoned"})),
            h.answer("Logged the 45 minute session and marked Severance as abandoned."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout", "imdbspy_list_media", "imdbspy_set_status"],
                               order=[("imdbspy_list_media", "imdbspy_set_status")],
                               forbidden=["imdbspy_delete_media", "exercise_delete_log"]),
        verify=lambda sb: _assert(_imdb_status(sb, "Severance") == "abandoned"),
    ),
    h.Scenario(
        id="mixed.rest_day",
        title="IMDbSpy + Recipes: something to watch and something to cook",
        groups=["core", "imdbspy", "recipes"],
        prompt="Rest day. Suggest a movie I haven't seen, and something I can cook with eggs and rice.",
        turns=[
            h.calls(
                h.call("imdbspy_list_media", "unseen movies", status="not_seen", kind="movie"),
                h.call("recipes_find_by_ingredients", "pantry match for the two ingredients", ingredient_names=["eggs", "rice"]),
            ),
            h.answer("Watch The Shawshank Redemption; the best egg-and-rice matches are listed above."),
        ],
        live=h.LiveExpectation(required=["imdbspy_list_media", "recipes_find_by_ingredients"],
                               forbidden=["imdbspy_delete_media", "recipes_delete_recipe"], answer_any=["shawshank"]),
    ),
    h.Scenario(
        id="mixed.timekeeper_to_calendar",
        title="Time Keeper + Calendar: repeat yesterday's coding block tomorrow",
        groups=["core", "timekeeper", "calendar"],
        prompt="Look at what I tracked on 2026-09-01 and book the same coding block on my calendar for tomorrow.",
        notes="The calendar write depends on times read from the time keeper: 08:00 for 60 minutes becomes 08:00-09:00.",
        turns=[
            h.calls(h.call("timekeeper_list_logs", "find the coding block's start and duration", date="2026-09-01")),
            h.calls(h.dynamic("calendar_add_direct_event", "translate start_time + duration into start/end",
                              lambda ctx: _coding_block_event(ctx))),
            h.answer("Booked Coding tomorrow 08:00-09:00, matching the block you tracked."),
        ],
        live=h.LiveExpectation(required=["timekeeper_list_logs", "calendar_add_direct_event"],
                               order=[("timekeeper_list_logs", "calendar_add_direct_event")]),
        verify=lambda sb: _assert("Coding" in _direct_titles(sb)),
    ),
    h.Scenario(
        id="mixed.deadline_reminder",
        title="Projects + Calendar: put a project's soonest goal deadline on the calendar",
        groups=["core", "projectmanager", "calendar"],
        prompt="Put the soonest goal deadline of my Scenario Garden Build project on the calendar as a 09:00-09:15 reminder.",
        notes="Two independent reads (projects for the id, goals for the deadlines) feed one calendar write; the goal is matched by project id, not by position.",
        turns=[
            h.calls(
                h.call("projectmanager_list_projects", "resolve the project id by title"),
                h.call("projectmanager_list_goals_with_deadlines", "soonest first across all projects; filter by project id"),
            ),
            h.calls(h.dynamic("calendar_add_direct_event", "deadline date -> event date; the title names the goal",
                              lambda ctx: _deadline_event(ctx))),
            h.answer("Added a reminder for 'Order lumber' on its deadline."),
        ],
        live=h.LiveExpectation(required=["projectmanager_list_goals_with_deadlines", "calendar_add_direct_event"],
                               order=[("projectmanager_list_goals_with_deadlines", "calendar_add_direct_event")]),
        verify=lambda sb: _assert(any("lumber" in t.lower() for t in _direct_titles(sb))),
    ),
    h.Scenario(
        id="mixed.email_to_calendar",
        title="Mailbox + Calendar: turn Sam's lunch email into an event",
        groups=["core", "mailbox", "calendar"],
        prompt="Sam emailed about lunch on Thursday. Find it and put lunch with Sam on Thursday 12:00-13:00.",
        turns=[
            h.calls(h.call("mailbox_list_accounts", "resolve the account first")),
            h.calls(h.dynamic("mailbox_list_messages", "find the lunch email",
                              lambda ctx: {"account": ctx.result("mailbox_list_accounts")["accounts"][0]["id"]})),
            h.calls(h.dynamic("calendar_add_direct_event", "next Thursday relative to today",
                              lambda ctx: {"date": _next_weekday(ctx.sandbox.today, 3), "title": "Lunch with Sam",
                                           "start": "12:00", "end": "13:00", "type": "personal"})),
            h.answer("Found Sam's email and booked lunch on Thursday 12:00-13:00."),
        ],
        live=h.LiveExpectation(required=["mailbox_list_messages", "calendar_add_direct_event"],
                               order=[("mailbox_list_messages", "calendar_add_direct_event")],
                               forbidden=["mailbox_send_message", "mailbox_delete_messages"]),
        verify=lambda sb: _assert(any("sam" in t.lower() for t in _direct_titles(sb))),
    ),
    h.Scenario(
        id="mixed.recipe_to_shopping_list",
        title="Recipes + Media viewer: save a recipe's ingredients as a file",
        groups=["core", "recipes", "media_viewer"],
        prompt="Take the ingredients of my first recipe and save them as scenario-shopping.md.",
        turns=[
            h.calls(h.call("recipes_list_recipes", "find the first recipe id")),
            h.calls(h.dynamic("recipes_get_recipe", "full detail carries the ingredient list",
                              lambda ctx: {"recipe_id": ctx.result("recipes_list_recipes")["recipes"][0]["id"]})),
            h.calls(h.dynamic("media_viewer_save_artifact", "render the list as markdown, base64 it, save",
                              lambda ctx: {"filename": "scenario-shopping.md", "mime_type": "text/markdown",
                                           "content_base64": base64.b64encode(
                                               "\n".join(f"- {i['name']}" for i in ctx.result("recipes_get_recipe")["recipe"]["ingredients"]).encode()
                                           ).decode()})),
            h.answer("Saved the ingredient list as scenario-shopping.md."),
        ],
        live=h.LiveExpectation(required=["recipes_get_recipe", "media_viewer_save_artifact"],
                               order=[("recipes_get_recipe", "media_viewer_save_artifact")]),
    ),
    h.Scenario(
        id="mixed.strava_then_email",
        title="Exercise + Mailbox: sync, then send the approved summary",
        groups=["core", "exercise", "mailbox"],
        history=approved("Sync my Strava week and email me the summary at scenario@example.com.",
                         "I'll sync first, then send 'Strava week' to scenario@example.com. OK to send?"),
        prompt="Yes.",
        turns=[
            h.calls(
                h.call("exercise_sync_strava", "the summary depends on the sync result", period="week"),
                h.call("mailbox_list_accounts", "resolve the sending account"),
            ),
            h.calls(h.dynamic("mailbox_send_message", "approved -> confirm: true; body from the sync counts",
                              lambda ctx: {"account": ctx.result("mailbox_list_accounts")["accounts"][0]["id"],
                                           "to": ["scenario@example.com"], "subject": "Strava week",
                                           "body": f"Imported {ctx.result('exercise_sync_strava')['strava_sync']['imported']} activities.",
                                           "confirm": True})),
            h.answer("Synced 2 new activities and emailed you the summary."),
        ],
        live=h.LiveExpectation(required=["exercise_sync_strava", "mailbox_send_message"],
                               order=[("exercise_sync_strava", "mailbox_send_message")]),
        verify=lambda sb: _assert(any(c["op"] == "send" and "2" in c["body"] for c in sb.mail.calls),
                                  "no email carrying the sync count was sent"),
    ),
    h.Scenario(
        id="mixed.history_into_timekeeper",
        title="Exercise + Time Keeper: paint a workout into a day without losing what is there",
        groups=["core", "exercise", "timekeeper"],
        history=approved("Paint my Sept 1 workout into the time keeper as Scenario Rest / Walk at 18:00, keeping the existing blocks.",
                         "That rewrites 2026-09-01 with the existing 90 minutes plus a 60 minute Walk block at 18:00. Save?"),
        prompt="Yes, save it.",
        notes="save_day replaces the day, so the existing logs must be read and re-sent together with the new block; three reads feed one write.",
        turns=[
            h.calls(
                h.call("exercise_list_history", "duration of the Sept 1 workout"),
                h.call("timekeeper_list_logs", "existing blocks must be preserved through the rewrite", date="2026-09-01"),
                h.call("timekeeper_list_categories", "resolve the Walk subcategory id"),
            ),
            h.calls(h.dynamic("timekeeper_save_day", "existing intervals + the new 18:00 block, confirm: true",
                              lambda ctx: _merged_day(ctx),
                              check=lambda r: _assert(sum(l["duration"] for l in r["logs"]) == 150))),
            h.answer("Saved: the existing 90 minutes plus a 60 minute walk at 18:00."),
        ],
        live=h.LiveExpectation(required=["exercise_list_history", "timekeeper_list_logs", "timekeeper_save_day"],
                               order=[("timekeeper_list_logs", "timekeeper_save_day")]),
        verify=lambda sb: _assert(_day_minutes(sb, "2026-09-01") == 150, "existing blocks were lost or the walk missing"),
    ),
    h.Scenario(
        id="mixed.partial_groups_denied",
        title="Only exercise is on: the IMDbSpy half is refused by the group gate",
        groups=["core", "exercise"],
        prompt="Log a 20 minute walk for 2026-09-08 and mark Severance as abandoned.",
        notes="Assembly hides the disabled tools; if the model calls one anyway the registry denies it with the enable_tool_group action.",
        turns=[
            h.calls(
                h.call("exercise_log_workout", "this half is allowed",
                       log={"id": "scn_walk_0908", "workout_id": "walk", "date": "2026-09-08",
                            "duration": 1200, "volume": 1.5, "exercises": []}),
                h.call("imdbspy_list_media", "hallucinated: the tool was never offered", search="severance",
                       expect=h.DENIED_GROUP,
                       check=lambda r: _assert(r["details"] == {"action": "enable_tool_group", "group": "imdbspy",
                                                                "tool": "imdbspy_list_media"})),
            ),
            h.answer("Logged the walk. I can't reach the movie tracker until the IMDbSpy tools are enabled."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout"], forbidden=["imdbspy_set_status"],
                               answer_any=["imdb", "enable", "not available", "can't", "cannot", "unable", "don't have", "no access", "tool"]),
        verify=lambda sb: _assert(_imdb_status(sb, "Severance") == "seen", "the status changed although the group was off"),
    ),
    h.Scenario(
        id="mixed.monday_briefing",
        title="Every group on: a briefing that reads four apps in one step",
        groups=["core", "calendar", "exercise", "imdbspy", "mailbox", "media_viewer",
                "projectmanager", "recipes", "timekeeper"],
        prompt="Give me a briefing: today's calendar, project deadlines, unseen movies, and my tracked minutes per day.",
        notes="With all nine groups on, all 69 tools are offered; the four reads are independent and go out together.",
        turns=[
            h.calls(
                h.dynamic("calendar_get_day", "today's calendar", lambda ctx: {"date": ctx.sandbox.today}),
                h.call("projectmanager_list_goals_with_deadlines", "deadlines"),
                h.call("imdbspy_list_media", "unseen movies", status="not_seen"),
                h.call("timekeeper_daily_totals", "minutes per day"),
            ),
            h.answer("Briefing: calendar, deadlines, unseen titles and tracked minutes are summarised above."),
        ],
        live=h.LiveExpectation(required=["projectmanager_list_goals_with_deadlines", "imdbspy_list_media",
                                         "timekeeper_daily_totals"],
                               forbidden=["mailbox_send_message", "mailbox_delete_messages"], max_calls=10),
    ),
]


def _deadline_event(ctx):
    project = find(ctx.result("projectmanager_list_projects")["projects"], title="Scenario Garden Build")
    goal = next(g for g in ctx.result("projectmanager_list_goals_with_deadlines")["goals"]
                if g["project_id"] == project["id"])
    return {"date": goal["deadline"][:10], "title": "Due: " + goal["title"],
            "start": "09:00", "end": "09:15", "type": "work"}


def _coding_block_event(ctx):
    log = find(ctx.result("timekeeper_list_logs")["logs"], subcategory_id="scn_code")
    start_index = _block_index(log["start_time"])
    end_index = start_index + log["duration"] // 5
    return {"date": ctx.sandbox.tomorrow, "title": "Coding", "type": "work",
            "start": log["start_time"], "end": f"{end_index // 12:02d}:{(end_index % 12) * 5:02d}"}


def _merged_day(ctx):
    existing = []
    for log in ctx.result("timekeeper_list_logs")["logs"]:
        start = _block_index(log["start_time"])
        for i in range(start, start + log["duration"] // 5):
            existing.append({"index": i, "category_id": log["category_id"], "subcategory_id": log["subcategory_id"]})
    cats = ctx.result("timekeeper_list_categories")["categories"]
    rest = find(cats, id="scn_rest")
    walk = find(rest["subcategories"], name="Walk")
    workout_minutes = find(ctx.result("exercise_list_history")["history"], id="scn_hist_1")["duration"] // 60
    new = [{"index": i, "category_id": rest["id"], "subcategory_id": walk["id"]}
           for i in range(_block_index("18:00"), _block_index("18:00") + workout_minutes // 5)]
    return {"date": "2026-09-01", "intervals": existing + new, "confirm": True}


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
