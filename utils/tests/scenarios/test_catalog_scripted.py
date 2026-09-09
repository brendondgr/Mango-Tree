"""Every catalog scenario, run through the real loop with the scripted provider."""

from __future__ import annotations

import pytest

from utils.agents.tools import groups as tool_groups
from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog import all_scenarios

SCENARIOS = all_scenarios()


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s.id for s in SCENARIOS])
def test_scenario(scenario, sandbox, scenario_sink):
    run = h.run_scripted(scenario, sandbox)
    scenario_sink.add(run)
    assert run.passed, "\n" + run.describe()


def test_catalog_exercises_every_registered_tool():
    """The catalog is only complete if every tool in tools.yaml is called somewhere."""
    all_tools = {name for names in tool_groups.tool_groups().values() for name in names}
    scripted = {tool for s in SCENARIOS for tool in s.scripted_tools}
    missing = sorted(all_tools - scripted)
    assert not missing, f"tools never called by any scenario: {missing}"


def test_scenario_ids_are_namespaced_by_group():
    for s in SCENARIOS:
        prefix = s.id.split(".", 1)[0]
        assert prefix in set(s.groups) | {"mixed", "decisions", "core"}, s.id
