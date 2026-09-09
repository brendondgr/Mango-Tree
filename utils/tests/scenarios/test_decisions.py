"""Explicit assertions on the decision scenarios beyond pass/fail."""

from __future__ import annotations

from utils.agents.tools import groups as tool_groups
from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog import all_scenarios

BY_ID = {s.id: s for s in all_scenarios()}


def test_step_budget_routes_observe_to_respond_without_a_third_model_call(sandbox):
    run = h.run_scripted(BY_ID["decisions.step_budget"], sandbox)
    assert run.passed, run.describe()
    assert run.steps_used == 2
    assert len(run.offered) == 2                      # the provider was asked exactly twice
    assert run.routes[-1]["edge"] == "observe -> respond"
    assert run.final_answer == "Done."                 # the loop's own fallback text


def test_all_groups_offer_all_tools(sandbox):
    run = h.run_scripted(BY_ID["mixed.monday_briefing"], sandbox)
    assert run.passed, run.describe()
    every_tool = sorted(n for names in tool_groups.tool_groups().values() for n in names)
    assert run.offered[0]["tools_offered"] == every_tool
    assert len(every_tool) == 69


def test_partial_groups_offer_only_their_union(sandbox):
    run = h.run_scripted(BY_ID["mixed.partial_groups_denied"], sandbox)
    assert run.passed, run.describe()
    offered = set(run.offered[0]["tools_offered"])
    assert {"exercise_log_workout", "search_web"} <= offered
    assert not any(t.startswith("imdbspy_") for t in offered)
    denied = next(c for c in run.calls if c.tool == "imdbspy_list_media")
    assert denied.gate == "denied" and denied.outcome == h.DENIED_GROUP


def test_provider_error_emits_error_event_and_no_answer(sandbox):
    run = h.run_scripted(BY_ID["decisions.provider_auth_error"], sandbox)
    assert run.passed, run.describe()
    kinds = [e["event"] for e in run.events]
    assert "error" in kinds and "final_answer" not in kinds and "tool_call" not in kinds
    error_event = next(e for e in run.events if e["event"] == "error")
    assert error_event["payload"]["code"] == "auth_error"


def test_dedup_result_is_keyed_to_the_skipped_call(sandbox):
    run = h.run_scripted(BY_ID["decisions.dedup_identical_call"], sandbox)
    assert run.passed, run.describe()
    skipped = run.calls[2]
    assert skipped.outcome == h.DEDUP and skipped.gate == "skipped"
    # The model was still told, on the next iteration, keyed to that call id.
    assert skipped.call_id in run.offered[3]["tool_result_ids"]


def test_crash_envelope_carries_a_traceback_but_the_loop_answers(sandbox):
    run = h.run_scripted(BY_ID["decisions.crashing_tool"], sandbox)
    assert run.passed, run.describe()
    assert "ZeroDivisionError" in run.calls[0].result["traceback"]
    assert run.final_answer
