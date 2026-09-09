"""Automatic tool selection: the router decides which app groups a message needs.

Every scenario here runs with ``tool_selection="auto"`` and nothing pinned but
core. The scripted router answers what :class:`Selection` says; in live mode
the real model decides and the ``groups_required`` / ``groups_forbidden``
expectations judge it.
"""

from __future__ import annotations

from utils.agents.providers.llm import LLMProviderError
from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import find

ALL_APP_GROUPS = ["calendar", "exercise", "imdbspy", "mailbox", "media_viewer",
                  "projectmanager", "recipes", "timekeeper"]

_RUN = {"id": "scn_sel_run", "workout_id": "run", "date": "2026-09-08",
        "duration": 1800, "volume": 5.0, "exercises": []}


def _imdb_status(sb, title):
    from utils.apps.imdbspy.backend.models import MediaItem
    return MediaItem.objects.get(title=title).status


SCENARIOS = [
    h.Scenario(
        id="selection.picks_exercise",
        title="One app: the router selects exercise for a workout request",
        tool_selection="auto",
        groups=["core", "exercise"],
        prompt="Log a 30 minute 5 km run for 2026-09-08.",
        notes="Nothing pinned; the select node adds exercise on top of core and the model then sees exactly those tools.",
        selection=h.Selection(["exercise"], "the user wants to record a run in the workout tracker",
                              expect_source="model"),
        turns=[
            h.calls(h.call("exercise_log_workout", "cardio log", log=_RUN)),
            h.answer("Logged the run."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout"], groups_required=["exercise"],
                               groups_forbidden=["mailbox", "imdbspy"]),
    ),
    h.Scenario(
        id="selection.picks_two_apps",
        title="Two apps: exercise and IMDbSpy for one message",
        tool_selection="auto",
        groups=["core", "exercise", "imdbspy"],
        prompt="Log a 30 minute run for 2026-09-08 and mark Severance as abandoned.",
        selection=h.Selection(["exercise", "imdbspy"], "a workout log and a tracker status change"),
        turns=[
            h.calls(
                h.call("exercise_log_workout", "the run", log=_RUN),
                h.call("imdbspy_list_media", "resolve Severance's id", search="severance"),
            ),
            h.calls(h.dynamic("imdbspy_set_status", "id from the read",
                              lambda ctx: {"item_id": find(ctx.result("imdbspy_list_media")["items"], title="Severance")["id"],
                                           "status": "abandoned"})),
            h.answer("Logged the run and marked Severance abandoned."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout", "imdbspy_set_status"],
                               groups_required=["exercise", "imdbspy"]),
        verify=lambda sb: _assert(_imdb_status(sb, "Severance") == "abandoned"),
    ),
    h.Scenario(
        id="selection.small_talk_selects_nothing",
        title="Small talk: the router selects no app group and no tool runs",
        tool_selection="auto",
        groups=["core"],
        prompt="Thanks, that's all for today!",
        selection=h.Selection([], "no app data is needed to reply", expect_source="model"),
        turns=[h.answer("You're welcome — see you tomorrow.")],
        live=h.LiveExpectation(max_calls=0, groups_forbidden=ALL_APP_GROUPS, answer_any=["welcome", "you", "!"]),
    ),
    h.Scenario(
        id="selection.follow_up_uses_context",
        title="A follow-up that needs the same app as the previous turn",
        tool_selection="auto",
        groups=["core", "imdbspy"],
        history=[h.AgentMessage(role="user", content="Which movies haven't I seen?"),
                 h.AgentMessage(role="agent", content="Only The Shawshank Redemption is unseen.")],
        prompt="Mark it as seen then.",
        notes="'it' only resolves through the earlier messages the router is shown.",
        selection=h.Selection(["imdbspy"], "the follow-up refers to the movie from the previous answer"),
        turns=[
            h.calls(h.call("imdbspy_list_media", "resolve the id", search="shawshank")),
            h.calls(h.dynamic("imdbspy_set_status", "mark seen",
                              lambda ctx: {"item_id": ctx.result("imdbspy_list_media")["items"][0]["id"], "status": "seen"})),
            h.answer("Marked The Shawshank Redemption as seen."),
        ],
        live=h.LiveExpectation(required=["imdbspy_set_status"], groups_required=["imdbspy"]),
        verify=lambda sb: _assert(_imdb_status(sb, "The Shawshank Redemption") == "seen"),
    ),
    h.Scenario(
        id="selection.miss_then_request",
        title="The router misses a group; the model adds it mid-turn with request_tool_groups",
        tool_selection="auto",
        groups=["core", "exercise"],
        prompt="Log a 20 minute walk for 2026-09-08 and mark Severance as abandoned.",
        notes="The select node picked only exercise. The system prompt lists imdbspy as not selected; the model requests it, and the next step offers its tools.",
        selection=h.Selection(["exercise"], "scripted miss: only the workout half was noticed"),
        turns=[
            h.calls(
                h.call("exercise_log_workout", "the half that is available now",
                       log={"id": "scn_sel_walk", "workout_id": "walk", "date": "2026-09-08",
                            "duration": 1200, "volume": 1.5, "exercises": []}),
                h.call("request_tool_groups", "the movie tracker is listed as not selected; ask for it",
                       groups=["imdbspy"], reason="the message also changes a show's status",
                       check=lambda r: _assert(r["granted"] == ["imdbspy"])),
            ),
            h.calls(h.call("imdbspy_list_media", "now offered: resolve the id", search="severance")),
            h.calls(h.dynamic("imdbspy_set_status", "status change",
                              lambda ctx: {"item_id": ctx.result("imdbspy_list_media")["items"][0]["id"],
                                           "status": "abandoned"})),
            h.answer("Logged the walk and marked Severance as abandoned."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout", "imdbspy_set_status"],
                               groups_required=["exercise", "imdbspy"]),
        verify=lambda sb: _assert(_imdb_status(sb, "Severance") == "abandoned"),
    ),
    h.Scenario(
        id="selection.denied_then_request",
        title="Calling an unselected group's tool is denied with a hint, then requested and retried",
        notes="The retry uses identical arguments: a group-gate denial must not count as 'already executed' for the dedup guard.",
        tool_selection="auto",
        groups=["core", "exercise"],
        prompt="Log a 20 minute walk for 2026-09-08 and tell me which movies I haven't seen.",
        selection=h.Selection(["exercise"], "scripted miss"),
        turns=[
            h.calls(h.call("imdbspy_list_media", "hallucinated: not offered this step", status="not_seen",
                           expect=h.DENIED_GROUP,
                           check=lambda r: _assert(r["details"]["group"] == "imdbspy"))),
            h.calls(h.call("request_tool_groups", "the denial said how to recover", groups=["imdbspy"])),
            h.calls(
                h.call("imdbspy_list_media", "second attempt, now allowed", status="not_seen"),
                h.call("exercise_log_workout", "the walk",
                       log={"id": "scn_sel_walk2", "workout_id": "walk", "date": "2026-09-08",
                            "duration": 1200, "volume": 1.5, "exercises": []}),
            ),
            h.answer("Logged the walk; The Shawshank Redemption is still unseen."),
        ],
    ),
    h.Scenario(
        id="selection.request_unknown_group",
        title="Requesting a group that does not exist is a typed validation_error",
        tool_selection="auto",
        groups=["core"],
        prompt="Play my running playlist on Spotify.",
        selection=h.Selection([], "no app covers music"),
        turns=[
            h.calls(h.call("request_tool_groups", "guessing a group that is not in the catalogue",
                           groups=["spotify"], expect=h.error("validation_error"))),
            h.answer("I don't have a music app; the groups I can use are listed above."),
        ],
    ),
    h.Scenario(
        id="selection.router_prose_falls_back_to_keywords",
        title="Unparseable router reply: keywords in the message pick the group",
        tool_selection="auto",
        groups=["core", "exercise"],
        prompt="Log my gym session: 45 minutes, 4000 volume, on 2026-09-08.",
        selection=h.Selection(raw="I think you need the workout stuff for this one.",
                              expect_source="keyword_fallback"),
        turns=[
            h.calls(h.call("exercise_log_workout", "log it",
                           log={"id": "scn_sel_gym", "workout_id": "scn_push", "date": "2026-09-08",
                                "duration": 2700, "volume": 4000, "exercises": []})),
            h.answer("Logged the session."),
        ],
    ),
    h.Scenario(
        id="selection.router_unknown_ids_are_dropped",
        title="Unknown ids in the router reply are dropped, known ones kept",
        tool_selection="auto",
        groups=["core", "exercise"],
        prompt="Show my workouts.",
        selection=h.Selection(raw='{"groups": ["fitness", "Exercise"], "reason": "workouts"}',
                              expect_source="model", expect_dropped=["fitness"]),
        turns=[
            h.calls(h.call("exercise_list_workouts", "list")),
            h.answer("Here are your workouts."),
        ],
    ),
    h.Scenario(
        id="selection.pinned_group_stays_on",
        title="A pinned group is offered even though the router did not pick it",
        tool_selection="auto",
        pinned=["core", "calendar"],
        groups=["core", "calendar", "exercise"],
        prompt="Log a 30 minute run for 2026-09-08.",
        notes="The user keeps calendar always-on; the router only sees the other groups as candidates.",
        selection=h.Selection(["exercise"], "a run to log"),
        turns=[
            h.calls(h.call("exercise_log_workout", "log", log=_RUN)),
            h.answer("Logged."),
        ],
        live=h.LiveExpectation(required=["exercise_log_workout"], groups_required=["exercise", "calendar"]),
    ),
    h.Scenario(
        id="selection.manual_mode_request_is_denied",
        title="Manual mode: request_tool_groups is refused with the enable action",
        tool_selection="manual",
        tags={"manual_only"},
        groups=["core", "exercise"],
        prompt="Log a run and mark Severance seen.",
        notes="With manual selection the user's switches stay the authority; the denial carries the chip payload.",
        turns=[
            h.calls(h.call("request_tool_groups", "the model asks for the movie tracker", groups=["imdbspy"],
                           expect=h.DENIED_GROUP,
                           check=lambda r: _assert(r["details"] == {"action": "enable_tool_group", "group": "imdbspy",
                                                                    "tool": "request_tool_groups"}))),
            h.answer("I can log the run, but the IMDbSpy tools are switched off in this chat."),
        ],
    ),
    h.Scenario(
        id="selection.router_provider_error",
        title="If the router's provider fails, the turn ends with an error before reasoning",
        tool_selection="auto",
        groups=["core"],
        prompt="Log a run.",
        selection=h.Selection(raise_error=LLMProviderError("Could not reach 'Local model server'.",
                                                           code="unreachable", provider="local")),
        expect_error="Could not reach",
        turns=[h.answer("unreachable")],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
