"""The harness itself: it must prove the loop, not just narrate it."""

from __future__ import annotations

import pytest

from utils.tests.scenarios import harness as h


def _skills_scenario(**over) -> h.Scenario:
    base = dict(
        id="harness.skills",
        title="Read a skill after listing them",
        groups=["core"],
        prompt="What skills do you have? Read the artifacts one.",
        turns=[
            h.calls(h.call("inspect_skills", "must list before reading (rule in tool description)")),
            h.calls(h.call("read_skill", "the user asked for the artifacts skill", skill_name="artifacts")),
            h.answer("The artifacts skill explains the workspace store."),
        ],
    )
    base.update(over)
    return h.Scenario(**base)


def test_scripted_run_records_every_decision():
    run = h.run_scripted(_skills_scenario())
    assert run.passed, run.describe()
    assert run.tool_sequence == ["inspect_skills", "read_skill"]
    first, second = run.calls
    assert first.gate == "allowed" and first.group == "core"
    assert first.outcome == h.OK and second.outcome == h.OK
    assert first.why.startswith("must list before reading")
    assert first.iteration == 0 and second.iteration == 1
    assert [r["edge"] for r in run.routes] == [
        "select -> reason",
        "reason -> act", "act -> observe", "observe -> reason",
        "reason -> act", "act -> observe", "observe -> reason",
        "reason -> respond",
    ]
    assert run.offered[0]["tools_offered"] == sorted(
        ["list_artifacts", "read_artifact", "inspect_skills", "read_skill",
         "inspect_chat_context", "request_tool_groups", "search_web"]
    )
    # Manual selection: the select node passed the session's set through.
    assert run.selection["source"] == "manual" and run.selection["groups"] == ["core"]
    # The result of iteration 0's call was replayed to the model on iteration 1.
    assert run.offered[1]["tool_result_ids"] == [first.call_id]
    assert run.final_answer == "The artifacts skill explains the workspace store."


def test_scripted_run_fails_when_the_outcome_differs_from_the_script():
    scenario = _skills_scenario(
        turns=[
            h.calls(h.call("read_skill", "wrong expectation on purpose",
                           skill_name="does-not-exist", expect=h.OK)),
            h.answer("done"),
        ]
    )
    run = h.run_scripted(scenario)
    assert not run.passed
    assert any("expected 'ok'" in f for f in run.failures), run.failures
    assert run.calls[0].outcome == h.FAILED


def test_group_gate_is_recorded_as_a_denial():
    scenario = _skills_scenario(
        groups=["core"],
        turns=[
            h.calls(h.call("exercise_list_workouts", "hallucinated: group is off",
                           expect=h.DENIED_GROUP)),
            h.answer("I cannot reach the exercise tools."),
        ],
    )
    run = h.run_scripted(scenario)
    assert run.passed, run.describe()
    rec = run.calls[0]
    assert rec.gate == "denied" and "not in enabled set" in rec.gate_reason
    assert rec.group == "exercise"
    # ...and the disabled tool was never offered to the model.
    assert "exercise_list_workouts" not in run.offered[0]["tools_offered"]


def test_dedup_is_classified_without_reaching_the_registry():
    scenario = _skills_scenario(
        turns=[
            h.calls(h.call("inspect_skills", "first")),
            h.calls(h.call("inspect_skills", "repeat with identical args", expect=h.DEDUP)),
            h.answer("done"),
        ]
    )
    run = h.run_scripted(scenario)
    assert run.passed, run.describe()
    assert run.calls[1].gate == "skipped"


def test_unknown_tool_and_result_checks():
    scenario = _skills_scenario(
        turns=[
            h.calls(h.call("no_such_tool", "typo", expect=h.UNKNOWN_TOOL)),
            h.calls(h.call("inspect_skills", "list", check=lambda r: _assert_has_artifacts(r))),
            h.answer("done"),
        ]
    )
    run = h.run_scripted(scenario)
    assert run.passed, run.describe()


def _assert_has_artifacts(result):
    assert "artifacts/SKILL.md" in result["skills"]


def test_dynamic_args_read_earlier_results():
    scenario = _skills_scenario(
        turns=[
            h.calls(h.call("inspect_skills", "list")),
            h.calls(h.dynamic(
                "read_skill", "read the first listed skill",
                lambda ctx: {"skill_name": ctx.result("inspect_skills")["skills"][0]},
            )),
            h.answer("done"),
        ]
    )
    run = h.run_scripted(scenario)
    assert run.passed, run.describe()
    assert run.calls[1].args["skill_name"].endswith("SKILL.md")


def test_script_overrun_is_a_failure():
    scenario = _skills_scenario(turns=[h.calls(h.call("inspect_skills", "list"))])
    run = h.run_scripted(scenario)
    assert not run.passed
    assert any("more turns" in f for f in run.failures)


def test_provider_error_scenario():
    from unittest.mock import patch
    from utils.agents.providers.llm import LLMProviderError

    scenario = _skills_scenario(turns=[h.answer("never")], expect_error="rejected the API key")
    failure = LLMProviderError("'Local' rejected the API key.", code="auth_error")
    with patch("utils.agents.coordinator.graph.stream_chat", side_effect=failure):
        # run_scripted patches stream_chat itself; nest by patching the provider it installs
        pass
    # Simulate through the harness: a provider that raises.
    with patch.object(h, "ScriptedProvider", lambda scenario, ctx: _Raiser(failure)):
        run = h.run_scripted(scenario)
    assert run.passed, run.describe()
    assert run.final_answer is None and "rejected" in run.error


class _Raiser:
    shown = []
    emitted = []
    injected = {}
    overran = False

    def __init__(self, exc):
        self.exc = exc

    def __call__(self, *a, **k):
        raise self.exc


def test_report_renders(tmp_path):
    sink = h.ReportSink()
    sink.add(h.run_scripted(_skills_scenario()))
    out = sink.write(tmp_path / "report")
    text = (out / "report.md").read_text()
    assert "harness.skills" in text and "inspect_skills" in text
    assert (out / "traces.json").exists()
