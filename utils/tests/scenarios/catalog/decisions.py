"""Decision scenarios: the loop's own policy, independent of any one app.

Each of these isolates one place a decision is made — the assembly gate, the
execution gate, the observe node's dedup, the step budget, the provider error
path, the registry's exception envelope — and records where it fired.
"""

from __future__ import annotations

from utils.agents.providers.llm import LLMProviderError
from utils.agents.tools.registry import registry
from utils.tests.scenarios import harness as h


def _register_boom(sb):
    registry.register("scn_boom")(lambda **kw: 1 / 0)


def _unregister_boom(sb):
    registry._tools.pop("scn_boom", None)


SCENARIOS = [
    h.Scenario(
        id="decisions.group_off_denied_at_execution",
        title="A disabled group's tool is refused at execution with the enable action",
        groups=["core"],
        prompt="List my workouts.",
        notes="Assembly never offered exercise_list_workouts; the execution gate is the guarantee if the model calls it anyway.",
        turns=[
            h.calls(h.call("exercise_list_workouts", "stale or hallucinated call to a disabled group",
                           expect=h.DENIED_GROUP,
                           check=lambda r: _assert(r["details"]["action"] == "enable_tool_group"
                                                   and r["details"]["group"] == "exercise"))),
            h.answer("The exercise tools are not enabled for this chat. Enable them and ask again."),
        ],
        live=h.LiveExpectation(forbidden=["exercise_list_workouts"], max_calls=2,
                               answer_any=["enable", "not available", "can't", "cannot", "unable", "don't have", "no access", "tool"]),
    ),
    h.Scenario(
        id="decisions.core_off_strips_base_tools",
        title="Disabling core removes the base tools too (manual mode only)",
        groups=["recipes"],
        tags={"manual_only"},
        prompt="Search the web for a pasta recipe and list mine.",
        turns=[
            h.calls(
                h.call("search_web", "core is off, so even web search is denied", query="pasta recipe", expect=h.DENIED_GROUP),
                h.call("recipes_list_recipes", "recipes is on", ),
            ),
            h.answer("Web search is switched off in this chat; here are your own recipes."),
        ],
    ),
    h.Scenario(
        id="decisions.dedup_identical_call",
        title="An identical repeat is skipped by the observe node; a different one runs",
        groups=["core", "imdbspy"],
        prompt="Search my tracker for 'sever', then for 'shaw', then 'sever' again.",
        notes="Dedup is keyed on tool + arguments within one turn; the skipped call still gets a result turn keyed to its id.",
        turns=[
            h.calls(h.call("imdbspy_list_media", "first search", search="sever")),
            h.calls(h.call("imdbspy_list_media", "different arguments -> runs", search="shaw")),
            h.calls(h.call("imdbspy_list_media", "same tool + same args as the first -> deduplicated", search="sever",
                           expect=h.DEDUP)),
            h.answer("'sever' matches Severance, 'shaw' matches The Shawshank Redemption; the repeat was already answered."),
        ],
    ),
    h.Scenario(
        id="decisions.step_budget",
        title="The step budget ends the turn without another model call",
        groups=["core", "exercise"],
        max_steps=2,
        prompt="List workouts, then routines, then equipment.",
        notes="After the second observe the budget is spent: the graph routes observe -> respond and answers 'Done.' without asking the provider again.",
        turns=[
            h.calls(h.call("exercise_list_workouts", "step 1")),
            h.calls(h.call("exercise_list_routines", "step 2 — the last one the budget allows")),
        ],
    ),
    h.Scenario(
        id="decisions.unknown_tool",
        title="A tool name that does not exist is reported, not executed",
        groups=["core", "exercise"],
        prompt="List my workouts.",
        turns=[
            h.calls(h.call("exercise_list_workout", "singular typo of a real tool", expect=h.UNKNOWN_TOOL)),
            h.calls(h.call("exercise_list_workouts", "corrected after the registry said not found")),
            h.answer("Here are your workouts."),
        ],
    ),
    h.Scenario(
        id="decisions.missing_required_argument",
        title="A required argument left out surfaces as a registry error envelope",
        groups=["core", "exercise"],
        prompt="Delete a workout.",
        notes="Documents current behaviour: the adapter raises TypeError and the registry wraps it as a crash envelope with a traceback rather than a typed validation_error.",
        turns=[
            h.calls(h.call("exercise_delete_workout", "the model forgot workout_id entirely", confirm=True,
                           expect=h.CRASHED)),
            h.answer("Which workout should I delete?"),
        ],
    ),
    h.Scenario(
        id="decisions.crashing_tool",
        title="A tool that raises does not take the loop down",
        groups=["core"],
        prompt="Run the boom tool.",
        setup=_register_boom,
        verify=_unregister_boom,
        turns=[
            h.calls(h.call("scn_boom", "a tool with a bug", expect=h.CRASHED)),
            h.answer("That tool failed with a division error."),
        ],
    ),
    h.Scenario(
        id="decisions.provider_auth_error",
        title="A provider failure ends the turn with an error, never a fabricated answer",
        groups=["core", "exercise"],
        prompt="List my workouts.",
        provider_failure=LLMProviderError("'Local model server' rejected the API key. Check it in Settings -> LLM.",
                                          code="auth_error", provider="local"),
        expect_error="rejected the API key",
        turns=[h.answer("unreachable")],
    ),
    h.Scenario(
        id="decisions.provider_unreachable",
        title="An unreachable provider is reported with its code",
        groups=["core"],
        prompt="Hello?",
        provider_failure=LLMProviderError("Could not reach 'Local model server'.", code="unreachable", provider="local"),
        expect_error="Could not reach",
        turns=[h.answer("unreachable")],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
