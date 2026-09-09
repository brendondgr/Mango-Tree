"""The catalog against the configured model. Opt-in: ``MANGO_LIVE_LLM=1``.

Each scenario's prompt is sent to the real provider with the real tool
definitions; the model's own reasoning is recorded as the reason for every call
and the scenario's :class:`LiveExpectation` judges the tool choices and order.
``MANGO_SCENARIO_ONLY=exercise,imdbspy`` narrows the set (ids, tags or groups).
"""

from __future__ import annotations

import os

import pytest

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog import all_scenarios
from utils.tests.scenarios.conftest import live_llm_config, live_llm_enabled

_only = [s for s in os.environ.get("MANGO_SCENARIO_ONLY", "").split(",") if s.strip()]
SCENARIOS = [s for s in all_scenarios(_only or None) if s.live is not None and not s.live.skip]

pytestmark = pytest.mark.skipif(
    not live_llm_enabled(), reason="set MANGO_LIVE_LLM=1 to run scenarios against the configured model"
)


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s.id for s in SCENARIOS])
def test_live_scenario(scenario, sandbox, scenario_sink):
    run = h.run_live(scenario, sandbox, llm_config=live_llm_config())
    scenario_sink.add(run)
    assert run.passed, "\n" + run.describe()
