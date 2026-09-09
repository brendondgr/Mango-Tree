# Tool scenarios

A scenario suite that drives every registered agent tool through the real
coordinator loop and records each decision the loop makes along the way. It
answers two questions the unit tests cannot: *do the 70 tools actually work
when the agent calls them in sequence*, and *does the agent choose the right
tools, in the right order, for a given request*.

Code: `utils/tests/scenarios/`. Reports: `.tool-scenarios/` (gitignored).

## What a scenario is

One user request plus the tool calls the agent is expected to make to satisfy
it, each with a stated reason:

```python
h.Scenario(
    id="exercise.create_workout_then_routine",
    title="Create a workout, then place it in the routine",
    groups=["core", "exercise"],
    prompt="Create a 'Leg Day' workout ... then put it on Tuesdays in my Scenario Weekly routine.",
    turns=[
        h.calls(h.call("exercise_save_workout", "the workout must exist before the routine can reference it", workout={...})),
        h.calls(h.call("exercise_list_routines", "save_routine upserts on id, so read the current routine first")),
        h.calls(h.dynamic("exercise_save_routine", "re-save with Tuesday pointing at the new workout",
                          lambda ctx: {"routine": {...ctx.result("exercise_list_routines")...}})),
        h.answer("Created Leg Day and scheduled it on Tuesdays."),
    ],
    live=h.LiveExpectation(required=["exercise_save_workout", "exercise_save_routine"],
                           order=[("exercise_save_workout", "exercise_save_routine")]),
    verify=lambda sb: ...,   # post-run check on the sandbox state
)
```

`dynamic` steps compute their arguments from earlier results, the way a model
has to — an id from a list call feeds the delete that follows. `expect` names
the outcome the call must have: `ok`, `denied_confirm` (the tool's own
`confirm: true` gate), `denied_group` (the tool-group gate), `dedup` (the
observe node skipped an identical repeat), `unknown_tool`, `crashed`, or
`error:<code>` for a typed service error such as `error:not_found`.

## Two modes, one harness

**Scripted** (`test_catalog_scripted.py`, runs in CI). A scripted provider plays
the model and emits the scenario's calls turn by turn. The graph, the tool
registry, the tool-group gates and the app services are all real; every app
store is bound to a throwaway copy by the `sandbox` fixture, and the network
seams (IMAP/SMTP, Strava, the IMDb scraper, SearXNG) are recording fakes. This
proves the plumbing: the tool exists, takes the arguments its schema
advertises, runs against the service, gates what it should, and its result
comes back correlated to the call that asked for it.

**Live** (`test_catalog_live.py`, opt-in with `MANGO_LIVE_LLM=1`). The same
prompts go to the configured provider with the real tool definitions. The
model's own reasoning is recorded as the reason for each call, and the
scenario's `LiveExpectation` judges the choices: tools that must be called,
tools that must not, ordering pairs, a cap on the number of calls, phrases the
answer must contain. This proves the decisions.

`MANGO_LIVE_PROVIDER` / `MANGO_LIVE_MODEL` pick the provider and model;
`MANGO_SCENARIO_ONLY=exercise,imdbspy` narrows the set by id prefix, tag or
group. A server that cannot parse tool calls (a vLLM started without
`--enable-auto-tool-choice`) fails every live scenario with the server's own
400; `test_router_live.py` still runs there, because the router call carries no
tools.

**Automatic selection** (`test_catalog_auto.py`). Every scripted scenario is
run a second time with nothing pinned and a scripted router answering with the
scenario's own groups, proving the `select` node reproduces exactly the set the
manual switches gave. `catalog/selection.py` then covers the selection layer
itself: one app, two apps, small talk selecting nothing, a follow-up resolved
from context, a router miss corrected mid-turn with `request_tool_groups`, a
denial-then-request retry, unparseable router output falling back to keywords,
unknown ids dropped, pinned groups staying on, manual mode refusing the
request, and a router provider failure ending the turn honestly.

## What is recorded

For every run the harness keeps:

- the tools **offered** to the model each iteration (the assembly gate);
- each **selection** decision — groups, pinned, selected, source, reason;
- each **call**: which reasoning iteration made it, its arguments, the reason
  (scripted `why` or the model's own text), the registry gate's verdict and
  why, the classified outcome, the tool's summary and result;
- the **graph path**, edge by edge, with the reason each edge was taken;
- the final answer or the error, and the post-run `verify` result.

`ReportSink` writes `report.md` and `traces.json` at the end of a pytest
session to `.tool-scenarios/pytest/` (or `MANGO_SCENARIO_REPORT_DIR`). The
Markdown report has a summary table, a coverage line (tools exercised out of
the registry), and a per-scenario section with a call table and the model's
reasoning per iteration in live mode.

## Running

```bash
uv run pytest utils/tests/scenarios
```

```bash
uv run utils/scripts/run_tool_scenarios.py --only exercise imdbspy
```

```bash
MANGO_LIVE_LLM=1 uv run utils/scripts/run_tool_scenarios.py --mode live --only selection
```

The runner is a thin wrapper over pytest that sets the environment, picks the
mode, and prints the report path.

## Catalog layout

| Module | Covers |
| --- | --- |
| `catalog/core.py` | artifacts, skills, chat context, auto and forced web search, a missing file |
| `catalog/<app>.py` | one per app group: reads, read-then-write chains, confirm-gate denials with the row proven to survive, approved deletes proven to land, typed errors |
| `catalog/mixed.py` | requests spanning two or more apps, and one with all nine groups on |
| `catalog/decisions.py` | the loop's own policy: both gates, dedup, the step budget, unknown tools, a crashing tool, missing arguments, provider failures |
| `catalog/selection.py` | automatic selection (D16) |

`test_catalog_scripted.py` asserts that the union of tools called across the
catalog equals the registry, so adding a tool without a scenario fails the
suite.

## Adding a scenario

1. Pick the module by group (or `mixed.py`); ids are `<group>.<slug>`.
2. Seed anything beyond the sandbox's defaults in `setup`, and check the
   effect in `verify`. Seeded ids start with `scn_` so they never collide with
   real rows on a machine that has data.
3. Give every call a `why`. The report is only useful if the reason is real.
4. Add a `LiveExpectation` unless the scenario only makes sense scripted.
