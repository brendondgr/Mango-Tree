"""The scenario catalog: one module per app group plus mixed and decision sets.

``all_scenarios()`` is the single entry point the tests and the CLI runner use.
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import Iterable, List

from utils.tests.scenarios.harness import Scenario


def all_scenarios(only: Iterable[str] | None = None) -> List[Scenario]:
    """Every scenario in the catalog, in module order, optionally filtered.

    ``only`` filters by scenario id prefix, tag, or enabled group — so
    ``only=["exercise"]`` selects the exercise-only scenarios plus every mixed
    scenario that enables the exercise group.
    """
    scenarios: List[Scenario] = []
    seen: set[str] = set()
    for module_info in sorted(pkgutil.iter_modules(__path__), key=lambda m: m.name):
        module = importlib.import_module(f"{__name__}.{module_info.name}")
        for scenario in getattr(module, "SCENARIOS", []):
            if scenario.id in seen:
                raise ValueError(f"duplicate scenario id: {scenario.id}")
            seen.add(scenario.id)
            scenarios.append(scenario)
    if only:
        wanted = {w.strip() for w in only if w and w.strip()}
        scenarios = [
            s
            for s in scenarios
            if any(
                s.id == w or s.id.startswith(w + ".") or w in s.tags or w in s.groups
                for w in wanted
            )
        ]
    return scenarios
