"""Exercise tools (15): workouts, routines, equipment, history, Strava."""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "exercise"]


def _workout_ids(sb):
    from utils.apps.exercise.backend.services import workouts
    return {w.id for w in workouts.list_workouts()}


def _history_ids(sb):
    from utils.apps.exercise.backend.services import history
    return {row.id for row in history.list_history()}


SCENARIOS = [
    h.Scenario(
        id="exercise.overview",
        title="What is set up: workouts and routines",
        groups=G,
        prompt="What workouts and weekly routines do I have set up?",
        notes="Two independent reads issued in one reasoning step; both results come back correlated.",
        turns=[
            h.calls(
                h.call("exercise_list_workouts", "the user asked about workouts; read before answering"),
                h.call("exercise_list_routines", "and about routines; independent read, same step"),
            ),
            h.answer("You have Scenario Push Day, scheduled Mondays and Thursdays in Scenario Weekly."),
        ],
        live=h.LiveExpectation(
            required=["exercise_list_workouts", "exercise_list_routines"],
            forbidden=["exercise_delete_workout", "exercise_delete_routine"],
            answer_any=["push"],
        ),
    ),
    h.Scenario(
        id="exercise.log_run",
        title="Log a run into history",
        groups=G,
        prompt="Log a 30 minute 5 km run for 2026-09-07.",
        notes="A single write with the shape the prompt guidance spells out (id, workout_id, date, duration, volume).",
        turns=[
            h.calls(h.call(
                "exercise_log_workout",
                "cardio goes to history with workout_id 'run'; duration in seconds, volume in km",
                log={"id": "scn_run_0907", "workout_id": "run", "date": "2026-09-07",
                     "duration": 1800, "volume": 5.0, "exercises": []},
                check=lambda r: _assert(r["log"]["id"] == "scn_run_0907"),
            )),
            h.answer("Logged a 30 minute, 5 km run on 2026-09-07."),
        ],
        live=h.LiveExpectation(
            required=["exercise_log_workout"],
            forbidden=["exercise_delete_log", "exercise_delete_workout"],
        ),
        verify=lambda sb: _assert(
            any(row.date == "2026-09-07" and row.workout_id in ("run", "Run")
                for row in __import__("utils.apps.exercise.backend.services.history",
                                      fromlist=["x"]).list_history()),
            "the run was not written to history",
        ),
    ),
    h.Scenario(
        id="exercise.create_workout_then_routine",
        title="Create a workout, then place it in the routine",
        groups=G,
        prompt=("Create a 'Leg Day' workout with squats 4x6 (rest 120s) and lunges 3x12 (rest 60s), "
                "then put it on Tuesdays in my Scenario Weekly routine."),
        notes="Ordering matters: the routine can only reference the workout id once it exists; the routine is read before it is upserted.",
        turns=[
            h.calls(h.call(
                "exercise_save_workout", "the workout must exist before the routine can reference it",
                workout={"id": "scn_legs", "name": "Leg Day", "color": "blue", "exercises": [
                    {"id": "scn_squat", "name": "Squat", "sets": 4, "reps": 6, "rest": 120},
                    {"id": "scn_lunge", "name": "Lunge", "sets": 3, "reps": 12, "rest": 60},
                ]},
            )),
            h.calls(h.call("exercise_list_routines", "save_routine upserts on id, so read the current routine first")),
            h.calls(h.dynamic(
                "exercise_save_routine", "re-save the routine with Tuesday (day 1) pointing at the new workout",
                lambda ctx: {"routine": {
                    **find(ctx.result("exercise_list_routines")["routines"], id="scn_routine"),
                    "workouts": {**find(ctx.result("exercise_list_routines")["routines"], id="scn_routine")["workouts"],
                                 "1": ["scn_legs"]},
                }},
                check=lambda r: _assert(r["routine"]["workouts"].get("1") == ["scn_legs"]),
            )),
            h.answer("Created Leg Day and scheduled it on Tuesdays."),
        ],
        live=h.LiveExpectation(
            required=["exercise_save_workout", "exercise_save_routine"],
            order=[("exercise_save_workout", "exercise_save_routine")],
            forbidden=["exercise_delete_routine", "exercise_delete_workout"],
        ),
    ),
    h.Scenario(
        id="exercise.equipment_lifecycle",
        title="Add equipment, hit the conflict, then update it",
        groups=G,
        prompt="Add a 20 kg kettlebell to my equipment, then rename it to 'Competition kettlebell'.",
        notes="add_equipment conflicts on a reused id; the tool surfaces a typed conflict rather than crashing, and update_equipment takes the existing id.",
        turns=[
            h.calls(h.call("exercise_add_equipment", "create the item with a fresh id",
                           equipment={"id": "scn_kb20", "name": "Kettlebell", "type": "kettlebell",
                                      "weight": 20, "unit": "kg"})),
            # Same id, different payload: an identical repeat would be deduplicated
            # by the observe node before reaching the tool (see decisions.dedup).
            h.calls(h.call("exercise_add_equipment", "a second add reusing the id must be a typed conflict, not a crash",
                           equipment={"id": "scn_kb20", "name": "Kettlebell (again)", "type": "kettlebell",
                                      "weight": 20, "unit": "kg"},
                           expect=h.error("conflict"))),
            h.calls(h.call("exercise_update_equipment", "rename via update, reusing the id",
                           equip_id="scn_kb20",
                           equipment={"id": "scn_kb20", "name": "Competition kettlebell",
                                      "type": "kettlebell", "weight": 20, "unit": "kg"},
                           check=lambda r: _assert(r["equipment"]["name"] == "Competition kettlebell"))),
            h.answer("Added the kettlebell and renamed it to Competition kettlebell."),
        ],
        live=h.LiveExpectation(
            required=["exercise_add_equipment", "exercise_update_equipment"],
            order=[("exercise_add_equipment", "exercise_update_equipment")],
            forbidden=["exercise_delete_equipment"],
        ),
    ),
    h.Scenario(
        id="exercise.history_progress",
        title="Volume this month from history",
        groups=G,
        prompt="How much total volume did I log in September 2026?",
        turns=[
            h.calls(h.call("exercise_list_history", "progress questions are answered from history")),
            h.answer("In September 2026 you logged 5,400 in volume on Scenario Push Day plus a 5 km run."),
        ],
        live=h.LiveExpectation(required=["exercise_list_history"],
                               forbidden=["exercise_log_workout", "exercise_delete_log"]),
    ),
    h.Scenario(
        id="exercise.fix_log_and_remove_run",
        title="Update one log, delete another (already approved)",
        groups=G,
        history=approved(
            "My Sept 1 session was 50 minutes, not 60. And remove the Sept 3 run entirely.",
            "I can shorten the Sept 1 session to 50 minutes and delete the Sept 3 run. Delete it?",
        ),
        prompt="Yes, delete it.",
        notes="Read to find the ids, update by id, then a confirmed delete; an update with an invented id is a typed not_found.",
        turns=[
            h.calls(h.call("exercise_list_history", "find the log ids for those dates instead of inventing them")),
            h.calls(
                h.dynamic("exercise_update_log", "duration is stored in seconds: 50 min = 3000",
                          lambda ctx: {"log_id": "scn_hist_1", "log": {
                              **find(ctx.result("exercise_list_history")["history"], id="scn_hist_1"),
                              "duration": 3000}},
                          check=lambda r: _assert(r["log"]["duration"] == 3000)),
                h.call("exercise_delete_log", "user approved the delete in the previous turn",
                       log_id="scn_hist_2", confirm=True),
            ),
            h.calls(h.call("exercise_update_log", "an invented id must come back as not_found",
                           log_id="scn_hist_ghost",
                           log={"id": "scn_hist_ghost", "workout_id": "run", "date": "2026-09-09",
                                "duration": 1, "volume": 1, "exercises": []},
                           expect=h.error("not_found"))),
            h.answer("Shortened Sept 1 to 50 minutes and removed the Sept 3 run."),
        ],
        live=h.LiveExpectation(
            required=["exercise_list_history", "exercise_update_log", "exercise_delete_log"],
            order=[("exercise_list_history", "exercise_update_log"),
                   ("exercise_list_history", "exercise_delete_log")],
        ),
        verify=lambda sb: _assert("scn_hist_2" not in _history_ids(sb), "scn_hist_2 still exists"),
    ),
    h.Scenario(
        id="exercise.delete_requires_confirm",
        title="Delete without approval is refused by the confirm gate",
        groups=G,
        prompt="Delete the Scenario Push Day workout.",
        notes="The confirm gate is enforced in the tool, not the prompt: an unconfirmed delete returns permission_denied and the workout survives.",
        turns=[
            h.calls(h.call("exercise_list_workouts", "resolve the workout id from its name")),
            h.calls(h.call("exercise_delete_workout", "no approval yet, so the call is made without confirm",
                           workout_id="scn_push", expect=h.DENIED_CONFIRM)),
            h.answer("Deleting Scenario Push Day is permanent. Shall I go ahead?"),
        ],
        live=h.LiveExpectation(required=[], forbidden=[], answer_any=["confirm", "sure", "go ahead", "permanent", "delete"]),
        verify=lambda sb: _assert("scn_push" in _workout_ids(sb), "the workout was deleted without approval"),
    ),
    h.Scenario(
        id="exercise.delete_after_approval",
        title="Delete after the user approved",
        groups=G,
        history=approved("Delete the Scenario Push Day workout.",
                         "That permanently deletes Scenario Push Day. Confirm?"),
        prompt="Yes, delete it.",
        turns=[
            h.calls(h.call("exercise_list_workouts", "resolve the id before deleting")),
            h.calls(h.call("exercise_delete_workout", "approved in the previous turn -> confirm: true",
                           workout_id="scn_push", confirm=True)),
            h.answer("Deleted Scenario Push Day."),
        ],
        live=h.LiveExpectation(required=["exercise_delete_workout"]),
        verify=lambda sb: _assert("scn_push" not in _workout_ids(sb), "the workout still exists"),
    ),
    h.Scenario(
        id="exercise.retire_routine_and_equipment",
        title="Delete a routine and an equipment item (approved)",
        groups=G,
        history=approved("Remove the Scenario Weekly routine and the Scenario Dumbbells from my equipment.",
                         "Both deletes are permanent. Go ahead with both?"),
        prompt="Yes, both.",
        turns=[
            h.calls(
                h.call("exercise_list_routines", "find the routine id"),
                h.call("exercise_list_equipment", "find the equipment id"),
            ),
            h.calls(
                h.call("exercise_delete_routine", "approved", routine_id="scn_routine", confirm=True),
                h.call("exercise_delete_equipment", "approved", equip_id="scn_dumbbells", confirm=True),
            ),
            h.answer("Removed the routine and the dumbbells."),
        ],
        live=h.LiveExpectation(required=["exercise_delete_routine", "exercise_delete_equipment"]),
    ),
    h.Scenario(
        id="exercise.strava_sync",
        title="Import this week's Strava activities",
        groups=G,
        prompt="Pull in my Strava runs from this week.",
        turns=[
            h.calls(h.call("exercise_sync_strava", "additive, de-duplicated import; 'week' matches the request",
                           period="week", check=lambda r: _assert(r["strava_sync"]["imported"] == 2))),
            h.answer("Imported 2 new activities from Strava (1 already present)."),
        ],
        live=h.LiveExpectation(required=["exercise_sync_strava"], answer_any=["import", "strava"]),
    ),
    h.Scenario(
        id="exercise.strava_not_configured",
        title="Strava sync without credentials is a typed permission_denied",
        groups=G,
        prompt="Sync my Strava activities.",
        setup=lambda sb: setattr(sb.strava, "configured", False),
        notes="The tool must surface the typed error and the model must relay it instead of retrying.",
        turns=[
            h.calls(h.call("exercise_sync_strava", "attempt the sync", period="week",
                           expect=h.error("permission_denied"))),
            h.answer("Strava credentials are not configured, so I could not sync."),
        ],
        live=h.LiveExpectation(required=["exercise_sync_strava"], max_calls=3,
                               answer_any=["credential", "configured", "connect", "set up", "setup"]),
    ),
    h.Scenario(
        id="exercise.validation_error",
        title="A malformed workout is a typed validation_error",
        groups=G,
        prompt="Save a workout called Mobility with no color.",
        turns=[
            h.calls(h.call("exercise_save_workout", "missing required 'color' -> validation_error",
                           workout={"id": "scn_mob", "name": "Mobility"},
                           expect=h.error("validation_error"))),
            h.answer("The workout needs a color; which one should I use?"),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
