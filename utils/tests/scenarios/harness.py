"""Scenario harness for the coordinator's tool calls.

A *scenario* is one user request plus the sequence of tool calls the agent is
expected to make to satisfy it. The harness runs the scenario through the real
LangGraph loop (``reason -> act -> observe -> respond``) with the real tool
registry, real tool-group gating and real app services, and records every
decision along the way:

* which node made the decision and which edge the graph took afterwards,
* which tools were *offered* to the model that iteration (assembly gate),
* each tool call with its arguments and the reason it was made,
* the execution-side gate verdict for that call (group enabled or denied),
* the classified outcome — ok, denied by the confirm gate, deduplicated,
  unknown tool, a typed service error — and the tool's own summary.

Two modes share all of that:

``scripted``
    A :class:`ScriptedProvider` stands in for the model and emits the calls the
    scenario spells out, turn by turn, each with a ``why``. Deterministic, no
    network, runs in CI. This proves the plumbing: the tools exist, take the
    arguments the schema advertises, run against the services, gate what they
    should, and their results flow back correlated to the call that asked.

``live``
    The configured provider is asked for real. The model's own reasoning is
    recorded as the ``why`` for each call, and the scenario's
    :class:`LiveExpectation` says which tools must, may, and must not be used
    and in what order. This proves the *decisions*: given the prompt and the
    tool guidance, the model reaches for the right tools in the right order.

Every run yields a :class:`ScenarioRun` holding the trace, which the report
writer renders to Markdown + JSON so a reader can see, per scenario, what was
called, why, where the decision was made, and what came back.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Union
from unittest.mock import patch

from utils.agents.coordinator.graph import agent_graph
from utils.agents.schemas.agent import AgentMessage
from utils.agents.tools import groups as tool_groups
from utils.agents.tools.registry import registry
from utils.shared.llm.kit.types import StreamChunk
from utils.shared.llm.kit.types import ToolCall as LlmToolCall

# --- outcome vocabulary --------------------------------------------------------

#: The tool ran and reported success.
OK = "ok"
#: Refused by the execution-side tool-group gate (D14) — group not enabled.
DENIED_GROUP = "denied_group"
#: Refused by the tool's own ``confirm: true`` gate (destructive operation).
DENIED_CONFIRM = "denied_confirm"
#: Skipped by the observe node: same tool + same arguments already ran this turn.
DEDUP = "dedup"
#: The registry has no tool of that name.
UNKNOWN_TOOL = "unknown_tool"
#: The tool raised instead of returning an envelope (a bug, not a policy).
CRASHED = "crashed"
#: Anything else that reported ``success: False`` without a typed error code.
FAILED = "failed"


def error(code: str) -> str:
    """Outcome label for a typed service error envelope, e.g. ``error("not_found")``."""
    return f"error:{code}"


def classify(obs: Dict[str, Any]) -> str:
    """Name the outcome of one observation from the loop.

    The classification is derived purely from the observation the observe node
    produced, so it is exactly what the model was told.
    """
    summary = str(obs.get("summary") or "")
    result = obs.get("result") or {}
    if summary.startswith("Skipped duplicate"):
        return DEDUP
    if not isinstance(result, dict):
        return OK if obs.get("success") else FAILED
    if (
        result.get("code") == "permission_denied"
        and (result.get("details") or {}).get("action") == "enable_tool_group"
    ):
        return DENIED_GROUP
    if summary.endswith("not found in registry."):
        return UNKNOWN_TOOL
    if "traceback" in result and not obs.get("success"):
        return CRASHED
    err = result.get("error")
    if isinstance(err, dict) and err.get("code"):
        code = str(err["code"])
        if code == "permission_denied" and "confirm" in str(err.get("message", "")).lower():
            return DENIED_CONFIRM
        return error(code)
    return OK if obs.get("success") else FAILED


# --- scenario description ------------------------------------------------------

ArgsSpec = Union[Dict[str, Any], Callable[["StepContext"], Dict[str, Any]]]


@dataclass
class StepContext:
    """What a scripted step can see when it computes its arguments.

    ``results`` holds every observation so far this scenario, oldest first, so a
    step can pick up the id a previous read returned — exactly how a model has
    to do it. ``sandbox`` is whatever the test fixture handed the run.
    """

    sandbox: Any
    results: List[Dict[str, Any]]

    def result(self, tool: str, occurrence: int = -1) -> Dict[str, Any]:
        """The ``result`` payload of the *n*-th observation of ``tool``."""
        matches = [o for o in self.results if o.get("tool") == tool]
        if not matches:
            raise LookupError(f"no observation of {tool!r} yet")
        return matches[occurrence].get("result") or {}


@dataclass
class ToolStep:
    """One tool call the scripted model makes, and why."""

    tool: str
    why: str
    args: ArgsSpec = field(default_factory=dict)
    #: The outcome label :func:`classify` must produce for this call.
    expect: str = OK
    #: Optional extra assertion on the observation's ``result`` payload.
    check: Optional[Callable[[Dict[str, Any]], None]] = None

    def resolve_args(self, ctx: StepContext) -> Dict[str, Any]:
        if callable(self.args):
            return dict(self.args(ctx))
        return dict(self.args)


def call(tool: str, why: str, *, expect: str = OK, check=None, **args) -> ToolStep:
    """Shorthand: ``call("exercise_list_workouts", "ground the answer")``."""
    return ToolStep(tool=tool, why=why, args=args, expect=expect, check=check)


def dynamic(tool: str, why: str, args: Callable[[StepContext], Dict[str, Any]],
            *, expect: str = OK, check=None) -> ToolStep:
    """A step whose arguments come from earlier results (``args(ctx) -> dict``)."""
    return ToolStep(tool=tool, why=why, args=args, expect=expect, check=check)


@dataclass
class Turn:
    """One model response: either tool calls (possibly several) or the answer."""

    steps: Sequence[ToolStep] = ()
    text: str = ""
    thinking: str = ""

    @property
    def is_final(self) -> bool:
        return not self.steps


def answer(text: str, thinking: str = "") -> Turn:
    return Turn(text=text, thinking=thinking)


def calls(*steps: ToolStep, thinking: str = "") -> Turn:
    return Turn(steps=list(steps), thinking=thinking)


@dataclass
class LiveExpectation:
    """What a real model must do with the scenario for it to pass."""

    #: Tools that must be called at least once.
    required: Sequence[str] = ()
    #: Tools that must never be called (e.g. a delete without approval).
    forbidden: Sequence[str] = ()
    #: ``(earlier, later)`` pairs: first call of ``earlier`` precedes first of ``later``.
    order: Sequence[tuple] = ()
    #: At least one of these substrings must appear in the final answer (case-insensitive).
    answer_any: Sequence[str] = ()
    #: Upper bound on the number of tool calls (a sanity check against loops).
    max_calls: int = 12
    #: Set when the scenario is only meaningful with a scripted provider.
    skip: str = ""


@dataclass
class Scenario:
    id: str
    title: str
    #: Enabled tool groups for the session (the user's toggles).
    groups: List[str]
    #: The user's message this turn.
    prompt: str
    #: The scripted model responses, in order; the last one must be an answer.
    turns: List[Turn]
    #: What a live model must do. ``None`` means the scenario is scripted-only.
    live: Optional[LiveExpectation] = None
    #: Earlier conversation, e.g. the user already approving a delete.
    history: List[AgentMessage] = field(default_factory=list)
    #: Extra seeding against the sandbox before the run.
    setup: Optional[Callable[[Any], None]] = None
    tags: set = field(default_factory=set)
    max_steps: int = 6
    web_search_mode: str = "auto"
    #: For provider-failure scenarios: the error message the turn must end with.
    expect_error: Optional[str] = None
    #: A short note on what the scenario proves, for the report.
    notes: str = ""
    #: Post-run check on the sandbox state (did the write land? is the row gone?).
    #: Runs in both modes; an AssertionError becomes a failure.
    verify: Optional[Callable[[Any], None]] = None

    @property
    def scripted_tools(self) -> List[str]:
        return [s.tool for t in self.turns for s in t.steps]


# --- the scripted provider -----------------------------------------------------

class ScriptedProvider:
    """Plays the model: emits each :class:`Turn` as the chunks an adapter would.

    Also records what it was *shown* every iteration — the message list and the
    tool definitions — so the run can prove the assembly gate (only enabled
    groups' tools were offered) and the correlation (the tool-result turn the
    loop appended is the one answering the call it made).
    """

    def __init__(self, scenario: Scenario, ctx: StepContext):
        self.scenario = scenario
        self.ctx = ctx
        self.iteration = 0
        self.shown: List[Dict[str, Any]] = []
        self.overran = False
        self.emitted: List[Dict[str, Any]] = []

    def __call__(self, messages, tools=None, config=None, **kwargs):
        shown = {
            "iteration": self.iteration,
            "tools_offered": sorted(t.name for t in (tools or [])),
            "message_roles": [m.role for m in messages],
            "tool_result_ids": [
                r.tool_call_id
                for m in messages
                if m.role == "tool"
                for r in (m.tool_results or [])
            ],
        }
        self.shown.append(shown)
        if self.iteration < len(self.scenario.turns):
            turn = self.scenario.turns[self.iteration]
        else:
            self.overran = True
            turn = answer("(script exhausted)")
        self.iteration += 1
        return list(self._chunks(turn))

    def _chunks(self, turn: Turn):
        yield StreamChunk(type="start", model="scripted")
        if turn.thinking:
            yield StreamChunk(type="thinking", text=turn.thinking, model="scripted")
        if turn.is_final:
            yield StreamChunk(type="text", text=turn.text, model="scripted")
        for index, step in enumerate(turn.steps):
            args = step.resolve_args(self.ctx)
            call_id = f"scn_{self.iteration}_{index}"
            self.emitted.append(
                {"id": call_id, "tool": step.tool, "args": args, "why": step.why,
                 "expect": step.expect, "check": step.check}
            )
            yield StreamChunk(
                type="tool_call",
                tool_call=LlmToolCall(id=call_id, name=step.tool, arguments=args),
                model="scripted",
            )
        yield StreamChunk(
            type="done",
            finish_reason="stop" if turn.is_final else "tool_calls",
            model="scripted",
        )


# --- trace recording -----------------------------------------------------------

@dataclass
class ToolCallRecord:
    """One tool call as the loop made it, with every decision attached."""

    seq: int
    call_id: str
    tool: str
    args: Dict[str, Any]
    group: Optional[str]
    #: Where the decision to call came from: the scripted step or the live model.
    why: str
    #: The registry's execution-side verdict and its reason.
    gate: str
    gate_reason: str
    #: Classified outcome of the observation.
    outcome: str
    summary: str
    success: bool
    result: Dict[str, Any]
    #: Iteration of the reason node that produced the call (0-based).
    iteration: int
    #: What the scripted scenario expected (scripted mode only).
    expected: Optional[str] = None
    duration_ms: float = 0.0


class TraceRecorder:
    """Collects the loop's callback events and the registry's gate decisions."""

    def __init__(self, enabled_groups: Optional[List[str]]):
        self.enabled_groups = enabled_groups
        self.events: List[Dict[str, Any]] = []
        self.gates: Dict[str, Dict[str, Any]] = {}
        self._t0 = time.perf_counter()
        self._iteration = -1
        self._reasoning: List[str] = []
        self.reasoning_by_iteration: Dict[int, str] = {}
        self._pending_gate_calls: List[Dict[str, Any]] = []

    def _stamp(self) -> float:
        return round((time.perf_counter() - self._t0) * 1000, 2)

    # The graph's callback -------------------------------------------------------
    def callback(self, event: str, payload: Dict[str, Any]) -> None:
        entry = {"seq": len(self.events), "t_ms": self._stamp(), "event": event}
        if event == "node_start":
            entry["node"] = payload.get("node")
            if payload.get("node") == "reason":
                self._iteration += 1
                self._reasoning = []
            entry["iteration"] = self._iteration
        elif event == "thinking_delta":
            self._reasoning.append(str(payload.get("content") or ""))
            self.reasoning_by_iteration[self._iteration] = "".join(self._reasoning)
            entry["content"] = payload.get("content")
        elif event == "tool_call":
            entry.update(
                {"call_id": payload.get("id"), "tool": payload.get("name"),
                 "arguments": payload.get("arguments"), "iteration": self._iteration}
            )
        elif event == "tool_result":
            entry.update(
                {"call_id": payload.get("call_id"), "tool": payload.get("tool"),
                 "success": payload.get("success"), "summary": payload.get("summary"),
                 "outcome": classify(payload), "iteration": self._iteration}
            )
        elif event == "final_answer":
            entry["text"] = payload.get("text")
            entry["references"] = payload.get("references")
        elif event == "error":
            entry["payload"] = payload
        self.events.append(entry)

    # The registry gate ----------------------------------------------------------
    def wrap_execute(self, original: Callable) -> Callable:
        def execute(name, arguments, enabled_groups=None):
            group = tool_groups.group_of(name)
            if enabled_groups is None:
                gate, reason = "ungated", "enabled_groups=None skips the gate"
            elif group is None:
                gate, reason = "allowed", f"{name!r} is not in tools.yaml, so no group applies"
            elif group in enabled_groups:
                gate, reason = "allowed", f"group {group!r} is enabled this session"
            else:
                gate, reason = "denied", (
                    f"group {group!r} is not in enabled set {sorted(enabled_groups)}"
                )
            started = time.perf_counter()
            result = original(name, arguments, enabled_groups)
            self._pending_gate_calls.append(
                {"tool": name, "gate": gate, "gate_reason": reason, "group": group,
                 "duration_ms": round((time.perf_counter() - started) * 1000, 2)}
            )
            return result

        return execute

    def pop_gate(self, tool: str) -> Dict[str, Any]:
        for index, entry in enumerate(self._pending_gate_calls):
            if entry["tool"] == tool:
                return self._pending_gate_calls.pop(index)
        # A deduplicated call never reaches the registry.
        return {"tool": tool, "gate": "skipped", "group": tool_groups.group_of(tool),
                "gate_reason": "observe node deduplicated the call before the registry",
                "duration_ms": 0.0}

    # Derived view ----------------------------------------------------------------
    def routes(self) -> List[Dict[str, Any]]:
        """The edges the graph took, reconstructed from node_start order."""
        nodes = [e for e in self.events if e["event"] == "node_start"]
        out = []
        for previous, current in zip(nodes, nodes[1:]):
            edge = f"{previous['node']} -> {current['node']}"
            if previous["node"] == "reason":
                reason = ("the model returned tool calls" if current["node"] == "act"
                          else "no tool calls (answer or error) -> respond")
            elif previous["node"] == "observe":
                reason = ("step budget left, results fed back to the model"
                          if current["node"] == "reason"
                          else "step budget exhausted or an error -> respond")
            else:
                reason = "unconditional"
            out.append({"edge": edge, "why": reason, "iteration": current.get("iteration")})
        return out


# --- running -------------------------------------------------------------------

@dataclass
class ScenarioRun:
    scenario_id: str
    title: str
    mode: str
    groups: List[str]
    prompt: str
    calls: List[ToolCallRecord]
    offered: List[Dict[str, Any]]
    routes: List[Dict[str, Any]]
    events: List[Dict[str, Any]]
    final_answer: Optional[str]
    error: Optional[str]
    steps_used: int
    duration_ms: float
    failures: List[str]
    model: str = ""
    notes: str = ""
    reasoning: Dict[int, str] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return not self.failures

    @property
    def tool_sequence(self) -> List[str]:
        return [c.tool for c in self.calls]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "title": self.title,
            "mode": self.mode,
            "model": self.model,
            "groups": self.groups,
            "prompt": self.prompt,
            "passed": self.passed,
            "failures": self.failures,
            "final_answer": self.final_answer,
            "error": self.error,
            "steps_used": self.steps_used,
            "duration_ms": self.duration_ms,
            "notes": self.notes,
            "calls": [
                {
                    "seq": c.seq, "call_id": c.call_id, "tool": c.tool, "group": c.group,
                    "args": c.args, "why": c.why, "gate": c.gate,
                    "gate_reason": c.gate_reason, "outcome": c.outcome,
                    "expected": c.expected, "summary": c.summary, "success": c.success,
                    "iteration": c.iteration, "duration_ms": c.duration_ms,
                    "result": _shrink(c.result),
                }
                for c in self.calls
            ],
            "tools_offered": self.offered,
            "routes": self.routes,
            "reasoning": {str(k): v for k, v in self.reasoning.items()},
            "events": self.events,
        }

    def describe(self) -> str:
        """A compact human-readable trace, used in assertion messages."""
        lines = [f"[{self.mode}] {self.scenario_id} — {self.title}",
                 f"  groups: {self.groups}",
                 f"  prompt: {self.prompt!r}"]
        for c in self.calls:
            flag = "" if c.expected in (None, c.outcome) else f"  <-- expected {c.expected}"
            lines.append(
                f"  #{c.seq} it{c.iteration} {c.tool}({_short(c.args)}) "
                f"gate={c.gate} outcome={c.outcome}{flag}"
            )
            lines.append(f"       why: {c.why}")
            lines.append(f"       -> {c.summary}")
        lines.append(f"  routes: {' | '.join(r['edge'] for r in self.routes)}")
        lines.append(f"  answer: {self.final_answer!r}")
        if self.error:
            lines.append(f"  error: {self.error}")
        for failure in self.failures:
            lines.append(f"  FAIL: {failure}")
        return "\n".join(lines)


def _short(value: Any, limit: int = 160) -> str:
    text = json.dumps(value, default=str, sort_keys=True)
    return text if len(text) <= limit else text[:limit] + "…"


def _shrink(value: Any, limit: int = 6000) -> Any:
    """Keep traces readable: drop media blobs, cap huge payloads."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k == "media_base64":
                out[k] = f"<{len(str(v))} base64 chars omitted>"
            else:
                out[k] = _shrink(v, limit)
        return out
    if isinstance(value, list):
        return [_shrink(v, limit) for v in value[:50]] + (
            [f"… {len(value) - 50} more"] if len(value) > 50 else []
        )
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + f"… [{len(value) - limit} chars truncated]"
    return value


def initial_state(scenario: Scenario, callback, llm_config=None) -> Dict[str, Any]:
    """The same shape ``utils.api.routes.agent._build_initial_state`` produces."""
    messages = list(scenario.history) + [AgentMessage(role="user", content=scenario.prompt)]
    return {
        "messages": messages,
        "step_count": 0,
        "max_steps": scenario.max_steps,
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "llm_turns": [],
        "web_search_mode": scenario.web_search_mode,
        "enabled_groups": list(scenario.groups),
        "workspace_id": None,
        "llm_config": llm_config,
        "callback": callback,
    }


def run_scripted(scenario: Scenario, sandbox: Any = None) -> ScenarioRun:
    """Run the scenario with the scripted provider and check every expectation."""
    if scenario.setup:
        scenario.setup(sandbox)
    recorder = TraceRecorder(list(scenario.groups))
    observations_view: List[Dict[str, Any]] = []
    ctx = StepContext(sandbox=sandbox, results=observations_view)
    provider = ScriptedProvider(scenario, ctx)

    # Keep the step context's view of results in sync with the loop.
    def callback(event, payload):
        recorder.callback(event, payload)
        if event == "tool_result":
            observations_view.append(payload)

    started = time.perf_counter()
    with patch("utils.agents.coordinator.graph.stream_chat", side_effect=provider), \
         patch.object(registry, "execute", recorder.wrap_execute(registry.execute)):
        final = agent_graph.invoke(initial_state(scenario, callback))
    duration = round((time.perf_counter() - started) * 1000, 2)

    calls = _collect_calls(recorder, final, why_for=_scripted_why(provider))
    run = ScenarioRun(
        scenario_id=scenario.id, title=scenario.title, mode="scripted",
        groups=list(scenario.groups), prompt=scenario.prompt, calls=calls,
        offered=provider.shown, routes=recorder.routes(), events=recorder.events,
        final_answer=final.get("final_answer"), error=final.get("error"),
        steps_used=final.get("step_count", 0), duration_ms=duration, failures=[],
        model="scripted", notes=scenario.notes, reasoning=recorder.reasoning_by_iteration,
    )
    run.failures = _check_scripted(scenario, provider, run) + _verify(scenario, sandbox)
    return run


def run_live(scenario: Scenario, sandbox: Any = None, llm_config=None) -> ScenarioRun:
    """Run the scenario against the configured provider and judge its decisions."""
    if scenario.setup:
        scenario.setup(sandbox)
    recorder = TraceRecorder(list(scenario.groups))
    offered: List[Dict[str, Any]] = []

    from utils.agents.coordinator import graph as graph_module

    real_stream = graph_module.stream_chat
    model_seen = {"id": ""}

    def spy_stream(messages, tools=None, config=None, **kw):
        offered.append(
            {"iteration": len(offered), "tools_offered": sorted(t.name for t in (tools or [])),
             "message_roles": [m.role for m in messages]}
        )
        for chunk in real_stream(messages, tools=tools, config=config, **kw):
            if chunk.model:
                model_seen["id"] = chunk.model
            yield chunk

    started = time.perf_counter()
    with patch("utils.agents.coordinator.graph.stream_chat", side_effect=spy_stream), \
         patch.object(registry, "execute", recorder.wrap_execute(registry.execute)):
        final = agent_graph.invoke(initial_state(scenario, recorder.callback, llm_config))
    duration = round((time.perf_counter() - started) * 1000, 2)

    calls = _collect_calls(recorder, final, why_for=_live_why(recorder))
    run = ScenarioRun(
        scenario_id=scenario.id, title=scenario.title, mode="live",
        groups=list(scenario.groups), prompt=scenario.prompt, calls=calls,
        offered=offered, routes=recorder.routes(), events=recorder.events,
        final_answer=final.get("final_answer"), error=final.get("error"),
        steps_used=final.get("step_count", 0), duration_ms=duration, failures=[],
        model=model_seen["id"], notes=scenario.notes,
        reasoning=recorder.reasoning_by_iteration,
    )
    run.failures = _check_live(scenario, run) + _verify(scenario, sandbox)
    return run


def _verify(scenario: Scenario, sandbox: Any) -> List[str]:
    if scenario.verify is None:
        return []
    try:
        scenario.verify(sandbox)
    except AssertionError as exc:
        return [f"post-run verify failed: {exc}"]
    except Exception as exc:  # a verify that crashes is a failure, not an error
        return [f"post-run verify raised {exc!r}"]
    return []


def _scripted_why(provider: ScriptedProvider):
    by_id = {e["id"]: e for e in provider.emitted}

    def why(call_id: str, iteration: int) -> str:
        return by_id.get(call_id, {}).get("why", "(not scripted)")

    return why


def _live_why(recorder: TraceRecorder):
    def why(call_id: str, iteration: int) -> str:
        text = recorder.reasoning_by_iteration.get(iteration, "").strip()
        return text or "(the model emitted the call without any visible reasoning)"

    return why


def _collect_calls(recorder: TraceRecorder, final: Dict[str, Any], why_for) -> List[ToolCallRecord]:
    calls: List[ToolCallRecord] = []
    call_events = {e["call_id"]: e for e in recorder.events if e["event"] == "tool_call"}
    for obs in final.get("observations", []):
        call_id = obs.get("call_id")
        call_event = call_events.get(call_id, {})
        iteration = call_event.get("iteration", -1)
        gate = recorder.pop_gate(obs.get("tool"))
        calls.append(
            ToolCallRecord(
                seq=len(calls), call_id=str(call_id), tool=obs.get("tool"),
                args={k: v for k, v in (obs.get("_arguments") or {}).items()
                      if k not in ("state_messages",)},
                group=gate.get("group"), why=why_for(call_id, iteration),
                gate=gate["gate"], gate_reason=gate["gate_reason"],
                outcome=classify(obs), summary=str(obs.get("summary") or ""),
                success=bool(obs.get("success")), result=obs.get("result") or {},
                iteration=iteration, duration_ms=gate.get("duration_ms", 0.0),
            )
        )
    return calls


# --- checks --------------------------------------------------------------------

def _check_scripted(scenario: Scenario, provider: ScriptedProvider, run: ScenarioRun) -> List[str]:
    failures: List[str] = []
    expected_tools = scenario.scripted_tools
    if run.tool_sequence != expected_tools:
        failures.append(
            f"tool sequence {run.tool_sequence} != scripted {expected_tools}"
        )
    if provider.overran:
        failures.append("the loop asked the provider for more turns than the script has")

    by_id = {e["id"]: e for e in provider.emitted}
    for record in run.calls:
        emitted = by_id.get(record.call_id)
        if not emitted:
            failures.append(f"call {record.call_id} ({record.tool}) was not scripted")
            continue
        record.expected = emitted["expect"]
        if record.outcome != emitted["expect"]:
            failures.append(
                f"{record.tool}: outcome {record.outcome!r}, expected {emitted['expect']!r} "
                f"— {record.summary}"
            )
        if emitted["check"] is not None and record.outcome == emitted["expect"]:
            try:
                emitted["check"](record.result)
            except AssertionError as exc:
                failures.append(f"{record.tool}: result check failed: {exc}")
            except Exception as exc:  # a check that crashes is a failure, not an error
                failures.append(f"{record.tool}: result check raised {exc!r}")

    # Assembly gate: exactly the enabled groups' tools were offered, every iteration.
    expected_offered = sorted(t.name for t in tool_groups.build_tool_schemas(scenario.groups))
    for shown in provider.shown:
        if shown["tools_offered"] != expected_offered:
            missing = set(expected_offered) - set(shown["tools_offered"])
            extra = set(shown["tools_offered"]) - set(expected_offered)
            failures.append(
                f"iteration {shown['iteration']}: offered tool set differs from the enabled "
                f"groups' (missing={sorted(missing)}, extra={sorted(extra)})"
            )

    # Correlation: on iteration n, every call made on iteration n-1 has a result turn.
    made_by_iteration: Dict[int, List[str]] = {}
    for record in run.calls:
        made_by_iteration.setdefault(record.iteration, []).append(record.call_id)
    for shown in provider.shown[1:]:
        previous = made_by_iteration.get(shown["iteration"] - 1, [])
        missing = [cid for cid in previous if cid not in shown["tool_result_ids"]]
        if missing:
            failures.append(
                f"iteration {shown['iteration']}: results for {missing} were not replayed "
                "to the model"
            )

    if scenario.expect_error:
        if not run.error or scenario.expect_error not in run.error:
            failures.append(f"expected error containing {scenario.expect_error!r}, got {run.error!r}")
        if run.final_answer is not None:
            failures.append("a failed turn must not produce a final answer")
    else:
        if run.error:
            failures.append(f"turn ended with an error: {run.error}")
        final_turn = scenario.turns[-1]
        if final_turn.is_final and run.final_answer != final_turn.text:
            failures.append(f"final answer {run.final_answer!r} != scripted {final_turn.text!r}")
    return failures


def _check_live(scenario: Scenario, run: ScenarioRun) -> List[str]:
    failures: List[str] = []
    live = scenario.live
    if live is None:
        return ["scenario has no live expectation"]
    if run.error:
        failures.append(f"turn ended with an error: {run.error}")
    seq = run.tool_sequence
    for tool in live.required:
        if tool not in seq:
            failures.append(f"required tool {tool} was never called (called: {seq})")
    for tool in live.forbidden:
        if tool in seq:
            failures.append(f"forbidden tool {tool} was called")
    for earlier, later in live.order:
        if earlier in seq and later in seq and seq.index(earlier) > seq.index(later):
            failures.append(f"{earlier} should be called before {later} (sequence {seq})")
    if len(seq) > live.max_calls:
        failures.append(f"{len(seq)} tool calls exceeds max_calls={live.max_calls}")
    crashed = [c.tool for c in run.calls if c.outcome in (CRASHED, UNKNOWN_TOOL)]
    if crashed:
        failures.append(f"calls crashed or hit unknown tools: {crashed}")
    if live.answer_any:
        text = (run.final_answer or "").lower()
        if not any(s.lower() in text for s in live.answer_any):
            failures.append(
                f"final answer mentions none of {list(live.answer_any)}: {run.final_answer!r}"
            )
    if not run.error and not (run.final_answer or "").strip():
        failures.append("no final answer")
    return failures


# --- reporting -----------------------------------------------------------------

class ReportSink:
    """Collects runs across a session and writes them out at the end."""

    def __init__(self):
        self.runs: List[ScenarioRun] = []

    def add(self, run: ScenarioRun) -> None:
        self.runs.append(run)

    def write(self, directory: Union[str, Path]) -> Path:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "traces.json").write_text(
            json.dumps([r.to_dict() for r in self.runs], indent=2, default=str),
            encoding="utf-8",
        )
        (directory / "report.md").write_text(render_markdown(self.runs), encoding="utf-8")
        return directory


def default_report_dir() -> Path:
    override = os.environ.get("MANGO_SCENARIO_REPORT_DIR")
    if override:
        return Path(override)
    from django.conf import settings

    return Path(settings.BASE_DIR) / ".tool-scenarios"


def render_markdown(runs: Iterable[ScenarioRun]) -> str:
    runs = list(runs)
    lines = ["# Tool scenario report", ""]
    passed = sum(1 for r in runs if r.passed)
    lines.append(f"{passed}/{len(runs)} scenarios passed.")
    lines.append("")
    lines.append("| Scenario | Mode | Groups | Calls | Result |")
    lines.append("| --- | --- | --- | --- | --- |")
    for r in runs:
        lines.append(
            f"| {r.scenario_id} | {r.mode} | {', '.join(r.groups)} | "
            f"{' → '.join(r.tool_sequence) or '—'} | {'pass' if r.passed else 'FAIL'} |"
        )
    lines.append("")
    all_tools = {name for names in tool_groups.tool_groups().values() for name in names}
    touched = {c.tool for r in runs for c in r.calls}
    lines.append(f"Tools exercised: {len(touched & all_tools)}/{len(all_tools)}.")
    untouched = sorted(all_tools - touched)
    if untouched:
        lines.append("Never called: " + ", ".join(untouched))
    lines.append("")
    for r in runs:
        lines.append(f"## {r.scenario_id} — {r.title}")
        lines.append("")
        lines.append(f"- Mode: `{r.mode}`" + (f" (model `{r.model}`)" if r.model else ""))
        lines.append(f"- Groups enabled: {', '.join(f'`{g}`' for g in r.groups)}")
        lines.append(f"- Prompt: {r.prompt}")
        if r.notes:
            lines.append(f"- Proves: {r.notes}")
        lines.append(f"- Result: **{'pass' if r.passed else 'FAIL'}**, "
                     f"{len(r.calls)} call(s), {r.steps_used} step(s), {r.duration_ms:.0f} ms")
        for f in r.failures:
            lines.append(f"  - FAIL: {f}")
        lines.append("")
        if r.calls:
            lines.append("| # | Where | Tool | Arguments | Why | Gate | Outcome | Summary |")
            lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
            for c in r.calls:
                lines.append(
                    f"| {c.seq} | reason#{c.iteration} | `{c.tool}` | `{_cell(_short(c.args, 120))}` "
                    f"| {_cell(c.why)} | {c.gate} | `{c.outcome}` | {_cell(c.summary)} |"
                )
            lines.append("")
        if r.routes:
            lines.append("Graph path: " + " · ".join(
                f"`{x['edge']}` ({x['why']})" for x in r.routes
            ))
            lines.append("")
        if r.mode == "live" and r.reasoning:
            lines.append("Model reasoning by iteration:")
            for it, text in sorted(r.reasoning.items()):
                snippet = text.strip().replace("\n", " ")
                if len(snippet) > 600:
                    snippet = snippet[:600] + "…"
                lines.append(f"- reason#{it}: {snippet}")
            lines.append("")
        if r.error:
            lines.append(f"Error: `{r.error}`")
        else:
            lines.append(f"Final answer: {_cell(r.final_answer or '')}")
        lines.append("")
    return "\n".join(lines)


def _cell(text: Any, limit: int = 240) -> str:
    text = str(text).replace("|", "\\|").replace("\n", " ")
    return text if len(text) <= limit else text[:limit] + "…"
