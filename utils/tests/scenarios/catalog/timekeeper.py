"""Time Keeper tools (5): logs, totals, categories, save_day, delete_log."""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "timekeeper"]


def _day_minutes(sb, date):
    from utils.apps.timekeeper.backend.services import logs
    return sum(dto.duration for dto in logs.list_logs(date=date))


SCENARIOS = [
    h.Scenario(
        id="timekeeper.day_summary",
        title="What was tracked on one day",
        groups=G,
        prompt="What did I track on 2026-09-01?",
        turns=[
            h.calls(h.call("timekeeper_list_logs", "scope the read to the one day asked about", date="2026-09-01",
                           check=lambda r: _assert(sum(l["duration"] for l in r["logs"]) == 90))),
            h.answer("On 2026-09-01 you tracked 60 minutes of coding and a 30 minute walk."),
        ],
        live=h.LiveExpectation(required=["timekeeper_list_logs"], forbidden=["timekeeper_save_day", "timekeeper_delete_log"]),
    ),
    h.Scenario(
        id="timekeeper.daily_totals",
        title="Minutes per day",
        groups=G,
        prompt="How many minutes have I tracked each day?",
        turns=[
            h.calls(h.call("timekeeper_daily_totals", "per-day totals are a dedicated read",
                           check=lambda r: _assert(find(r["days"], date="2026-09-01")["total_duration"] == 90))),
            h.answer("Your per-day totals are listed above."),
        ],
        live=h.LiveExpectation(required=["timekeeper_daily_totals"]),
    ),
    h.Scenario(
        id="timekeeper.paint_requires_confirm",
        title="Painting a day without approval is refused",
        groups=G,
        prompt="Log 2026-09-02 as coding from 09:00 to 10:00.",
        notes="save_day overwrites the whole day, so it is confirm-gated; the taxonomy must be read to resolve ids first.",
        turns=[
            h.calls(h.call("timekeeper_list_categories", "resolve category/subcategory ids; never invent them")),
            h.calls(h.call("timekeeper_save_day", "not yet approved -> no confirm", date="2026-09-02",
                           intervals=[{"index": i, "category_id": "scn_work", "subcategory_id": "scn_code"}
                                      for i in range(108, 120)],
                           expect=h.DENIED_CONFIRM)),
            h.answer("This replaces everything on 2026-09-02 with 09:00-10:00 coding. Shall I save it?"),
        ],
        live=h.LiveExpectation(required=["timekeeper_list_categories"],
                               answer_any=["confirm", "save", "go ahead", "replace", "overwrite", "sure"]),
        verify=lambda sb: _assert(_day_minutes(sb, "2026-09-02") == 0, "the day was written without approval"),
    ),
    h.Scenario(
        id="timekeeper.paint_after_approval",
        title="Paint a day after approval",
        groups=G,
        history=approved("Log 2026-09-02 as coding from 09:00 to 10:00.",
                         "That will replace everything on 2026-09-02 with 09:00-10:00 coding. Save it?"),
        prompt="Yes, save it.",
        turns=[
            h.calls(h.call("timekeeper_list_categories", "resolve ids")),
            h.calls(h.call("timekeeper_save_day", "approved -> confirm: true; blocks 108..119 are 09:00-10:00",
                           date="2026-09-02", confirm=True,
                           intervals=[{"index": i, "category_id": "scn_work", "subcategory_id": "scn_code"}
                                      for i in range(108, 120)],
                           check=lambda r: _assert(r["saved"] == 1 and r["logs"][0]["duration"] == 60))),
            h.answer("Saved 60 minutes of coding on 2026-09-02."),
        ],
        live=h.LiveExpectation(required=["timekeeper_save_day"],
                               order=[("timekeeper_list_categories", "timekeeper_save_day")]),
        verify=lambda sb: _assert(_day_minutes(sb, "2026-09-02") == 60, "the day was not saved"),
    ),
    h.Scenario(
        id="timekeeper.delete_log_after_approval",
        title="Delete one log after approval",
        groups=G,
        history=approved("Delete the walk I logged on 2026-09-01.", "That removes the 30 minute walk for good. Delete it?"),
        prompt="Yes.",
        turns=[
            h.calls(h.call("timekeeper_list_logs", "get the integer log id", date="2026-09-01")),
            h.calls(h.dynamic("timekeeper_delete_log", "approved -> confirm: true",
                              lambda ctx: {"log_id": find(ctx.result("timekeeper_list_logs")["logs"],
                                                          subcategory_id="scn_walk")["id"], "confirm": True})),
            h.answer("Deleted the walk."),
        ],
        live=h.LiveExpectation(required=["timekeeper_list_logs", "timekeeper_delete_log"],
                               order=[("timekeeper_list_logs", "timekeeper_delete_log")]),
        verify=lambda sb: _assert(_day_minutes(sb, "2026-09-01") == 60, "the walk was not deleted"),
    ),
    h.Scenario(
        id="timekeeper.delete_requires_confirm_and_bad_date",
        title="Unconfirmed delete is refused; a bad date is a validation_error",
        groups=G,
        prompt="Delete log 1 and show me what I tracked on 'yesterday-ish'.",
        turns=[
            h.calls(
                h.call("timekeeper_delete_log", "no approval -> no confirm", log_id=1, expect=h.DENIED_CONFIRM),
                h.call("timekeeper_list_logs", "the date is not YYYY-MM-DD", date="yesterday-ish",
                       expect=h.error("validation_error")),
            ),
            h.answer("I need your confirmation to delete, and a date in YYYY-MM-DD form."),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
