"""The whole catalog again, in automatic selection mode.

Each manual scenario is cloned with nothing pinned and a scripted router that
answers with the scenario's own app groups. Passing proves that the select
node reproduces exactly the set the manual switches gave, and that every tool
behaves identically underneath it.
"""

from __future__ import annotations

import dataclasses

import pytest

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog import all_scenarios


def as_auto(scenario: h.Scenario) -> h.Scenario:
    return dataclasses.replace(
        scenario,
        id=scenario.id + "@auto",
        tool_selection="auto",
        pinned=["core"],
        selection=None,
        tags=set(scenario.tags) | {"auto"},
        live=(dataclasses.replace(scenario.live, groups_required=[g for g in scenario.groups if g != "core"])
              if scenario.live else None),
    )


SCENARIOS = [
    as_auto(s) for s in all_scenarios()
    if s.tool_selection == "manual" and "manual_only" not in s.tags
]


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s.id for s in SCENARIOS])
def test_scenario_under_automatic_selection(scenario, sandbox, scenario_sink):
    run = h.run_scripted(scenario, sandbox)
    scenario_sink.add(run)
    assert run.passed, "\n" + run.describe()
    assert run.selection is not None and run.selection["source"] in ("model", "no_candidates")
