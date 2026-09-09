"""Automatic tool-group selection (docs/tool-groups.md, D16).

The select node, the router prompt and parser, the keyword fallback, the
mid-turn ``request_tool_groups`` grant, the manual-mode denial, and the route's
``tool_selection`` field. Providers are scripted; nothing here touches a model.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from utils.agents.coordinator import selection
from utils.agents.coordinator.graph import (
    agent_graph,
    build_system_prompt,
    observe_node,
    select_node,
)
from utils.agents.providers.llm import LLMProviderError
from utils.agents.schemas.agent import AgentMessage, ToolCall
from utils.agents.tools import groups
from utils.agents.tools.registry import registry
from utils.api.routes.agent import _build_initial_state
from utils.shared.llm.kit.types import StreamChunk
from utils.shared.llm.kit.types import ToolCall as LlmToolCall

APP_GROUPS = ["calendar", "exercise", "imdbspy", "mailbox", "media_viewer",
              "projectmanager", "recipes", "timekeeper"]


def _router_reply(text):
    return [StreamChunk(type="start", model="router-model"),
            StreamChunk(type="text", text=text, model="router-model"),
            StreamChunk(type="done", finish_reason="stop", model="router-model")]


def _state(prompt="Log my run", **over):
    state = {
        "messages": [AgentMessage(role="user", content=prompt)],
        "step_count": 0, "max_steps": 6, "pending_actions": [], "observations": [],
        "final_answer": None, "error": None, "llm_turns": [], "web_search_mode": "auto",
        "enabled_groups": ["core"], "pinned_groups": ["core"], "tool_selection": "auto",
        "selection": None, "workspace_id": None, "llm_config": None, "callback": None,
    }
    state.update(over)
    return state


def _recorder():
    events = []
    return events, lambda event, payload: events.append((event, payload))


# --- catalogue + prompt ---------------------------------------------------------

def test_every_app_group_has_a_description_and_keywords():
    for group in APP_GROUPS:
        assert groups.group_description(group) and "Tools:" not in groups.group_description(group)
        assert groups.group_keywords(group)


def test_selectable_groups_excludes_core_and_pinned_and_unmet_requires(monkeypatch):
    assert groups.selectable_groups(["core"]) == APP_GROUPS
    assert "calendar" not in groups.selectable_groups(["core", "calendar"])
    monkeypatch.setattr(groups, "group_requires", lambda g: "workspace" if g == "mailbox" else None)
    assert "mailbox" not in groups.selectable_groups(["core"], capabilities=set())
    assert "mailbox" in groups.selectable_groups(["core"], capabilities={"workspace"})


def test_router_prompt_lists_candidates_with_descriptions_and_tools():
    prompt = selection.build_selection_prompt(["exercise", "imdbspy"])
    assert "- exercise (Exercise):" in prompt and "exercise_log_workout" in prompt
    assert "- imdbspy (IMDbSpy):" in prompt
    assert "mailbox" not in prompt
    assert '"groups"' in prompt


def test_router_messages_mark_the_latest_message_and_keep_recent_context():
    messages = [AgentMessage(role="user", content="My cat is Pumpkin."),
                AgentMessage(role="agent", content="Noted."),
                AgentMessage(role="user", content="Log my run.")]
    out = selection.build_router_messages(messages, ["exercise"])
    assert out[0].role == "system" and out[1].role == "user"
    body = out[1].content
    assert body.endswith("Latest user message:\nLog my run.")
    assert "assistant: Noted." in body and "user: My cat is Pumpkin." in body


# --- parser ------------------------------------------------------------------------

@pytest.mark.parametrize("text", [
    '{"groups": ["exercise"], "reason": "logging a run"}',
    'Sure! ```json\n{"groups": ["exercise"], "reason": "logging a run"}\n```',
    'The answer is {"groups": ["Exercise"], "reason": "logging a run"} — done.',
    '["exercise"]',
    '{"groups": "exercise", "reason": "x"}',
])
def test_parse_selection_tolerates_common_shapes(text):
    parsed = selection.parse_selection(text, APP_GROUPS)
    assert parsed["groups"] == ["exercise"]


def test_parse_selection_drops_unknown_ids_and_dedupes():
    parsed = selection.parse_selection(
        '{"groups": ["fitness", "exercise", "exercise", "core"], "reason": "x"}', APP_GROUPS
    )
    assert parsed["groups"] == ["exercise"]
    assert parsed["dropped"] == ["fitness", "core"]


def test_parse_selection_returns_none_for_prose():
    assert selection.parse_selection("I think you want the workout stuff.", APP_GROUPS) is None
    assert selection.parse_selection("", APP_GROUPS) is None


def test_keyword_fallback_matches_labels_ids_and_keywords():
    assert selection.keyword_fallback("log my gym session", APP_GROUPS) == ["exercise"]
    assert selection.keyword_fallback("what's on my calendar and any unread email?", APP_GROUPS) == ["calendar", "mailbox"]
    assert selection.keyword_fallback("thanks!", APP_GROUPS) == []


# --- select_tool_groups ------------------------------------------------------------

def test_select_tool_groups_records_model_decision():
    with patch.object(selection, "stream_chat",
                      return_value=_router_reply('{"groups": ["exercise", "imdbspy"], "reason": "run + movie"}')) as call:
        result = selection.select_tool_groups([AgentMessage(role="user", content="x")], APP_GROUPS)
    assert result.selected == ["exercise", "imdbspy"]
    assert result.source == "model" and result.reason == "run + movie" and result.model == "router-model"
    # No tools, deterministic sampling.
    assert call.call_args.kwargs["tools"] is None
    assert call.call_args.kwargs["params"].temperature == 0


def test_select_tool_groups_falls_back_to_keywords_when_unparsable():
    with patch.object(selection, "stream_chat", return_value=_router_reply("workout stuff, I guess")):
        result = selection.select_tool_groups([AgentMessage(role="user", content="log my run")], APP_GROUPS)
    assert result.selected == ["exercise"] and result.source == "keyword_fallback"


def test_select_tool_groups_skips_the_call_without_candidates():
    with patch.object(selection, "stream_chat") as call:
        result = selection.select_tool_groups([AgentMessage(role="user", content="x")], [])
    assert result.selected == [] and result.source == "no_candidates"
    call.assert_not_called()


# --- select node -------------------------------------------------------------------

def test_select_node_manual_mode_passes_the_session_set_through():
    events, callback = _recorder()
    with patch.object(selection, "stream_chat") as call:
        out = select_node(_state(tool_selection="manual", enabled_groups=["core", "mailbox"],
                                 pinned_groups=None, callback=callback))
    call.assert_not_called()
    assert out["enabled_groups"] == ["core", "mailbox"]
    assert out["selection"]["source"] == "manual"
    assert [e for e, _ in events] == ["node_start", "tool_groups_selected"]


def test_select_node_auto_mode_adds_router_choice_to_core_and_pinned():
    events, callback = _recorder()
    with patch.object(selection, "stream_chat",
                      return_value=_router_reply('{"groups": ["exercise"], "reason": "a run"}')):
        out = select_node(_state(enabled_groups=["calendar"], pinned_groups=["calendar"], callback=callback))
    assert out["enabled_groups"] == ["core", "calendar", "exercise"]
    record = dict(events[-1][1])
    assert record["selected"] == ["exercise"] and record["pinned"] == ["calendar"]
    assert record["source"] == "model" and record["reason"] == "a run"
    # A pinned group is never offered to the router as a candidate.
    assert "calendar" not in record["candidates"]


def test_select_node_auto_mode_core_is_always_on():
    with patch.object(selection, "stream_chat", return_value=_router_reply('{"groups": [], "reason": "chit-chat"}')):
        out = select_node(_state(enabled_groups=[], pinned_groups=[]))
    assert out["enabled_groups"] == ["core"]


def test_select_node_provider_error_ends_the_turn_honestly():
    events, callback = _recorder()
    failure = LLMProviderError("Could not reach 'Local'.", code="unreachable", provider="local")
    with patch.object(selection, "stream_chat", side_effect=failure), \
         patch("utils.agents.coordinator.graph.stream_chat") as reason_call:
        result = agent_graph.invoke(_state(callback=callback))
    reason_call.assert_not_called()
    assert result["error"] == failure.message and result["final_answer"] is None
    kinds = [e for e, _ in events]
    assert "error" in kinds and "final_answer" not in kinds


def test_graph_runs_select_then_reason_with_the_selected_tools():
    """End to end: router picks exercise, reason sees exercise tools, calls one."""
    seen = {}

    def fake_reason(messages, tools=None, config=None, **kw):
        seen["tools"] = sorted(t.name for t in tools)
        seen["system"] = messages[0].content
        if "done" in seen:
            return _router_reply("Logged.")
        seen["done"] = True
        return [StreamChunk(type="tool_call", model="m",
                            tool_call=LlmToolCall(id="c1", name="exercise_list_workouts", arguments={})),
                StreamChunk(type="done", finish_reason="tool_calls", model="m")]

    with patch.object(selection, "stream_chat",
                      return_value=_router_reply('{"groups": ["exercise"], "reason": "workouts"}')), \
         patch("utils.agents.coordinator.graph.stream_chat", side_effect=fake_reason), \
         patch.object(registry, "execute", return_value=__import__("utils.agents.schemas.agent", fromlist=["x"]).ToolResult(
             success=True, result={"workouts": []}, summary="ok", artifact_ids=[])):
        result = agent_graph.invoke(_state())
    assert "exercise_list_workouts" in seen["tools"]
    assert not any(t.startswith("imdbspy_") for t in seen["tools"])
    # The prompt tells the model which groups it can still request.
    assert "request_tool_groups" in seen["system"] and "- imdbspy (IMDbSpy)" in seen["system"]
    assert "- exercise (Exercise)" not in seen["system"].split("Not selected for this message:")[1]
    assert result["selection"]["selected"] == ["exercise"]
    assert result["final_answer"] == "Logged."


def test_system_prompt_without_selectable_has_no_request_block():
    assert "request_tool_groups" not in build_system_prompt("auto", ["core"])
    assert "Not selected for this message" in build_system_prompt("auto", ["core"], ["exercise"])


# --- request_tool_groups -------------------------------------------------------------

def test_request_tool_groups_validates_ids():
    ok = registry.execute("request_tool_groups", {"groups": ["Exercise", "imdbspy", "spotify"], "reason": "r"})
    assert ok.success and ok.result["requested"] == ["exercise", "imdbspy"] and ok.result["unknown"] == ["spotify"]
    bad = registry.execute("request_tool_groups", {"groups": ["spotify"]})
    assert not bad.success and bad.result["error"]["code"] == "validation_error"
    empty = registry.execute("request_tool_groups", {"groups": []})
    assert not empty.success
    core = registry.execute("request_tool_groups", {"groups": ["core"]})
    assert not core.success


def test_observe_grants_requested_groups_in_auto_mode():
    events, callback = _recorder()
    state = _state(step_count=1, callback=callback,
                   enabled_groups=["core", "exercise"], pinned_groups=["core"],
                   selection={"groups": ["core", "exercise"], "selected": ["exercise"], "pinned": ["core"],
                              "reason": "r", "source": "model", "candidates": [], "dropped": [], "model": ""},
                   pending_actions=[ToolCall(id="c1", name="request_tool_groups",
                                             arguments={"groups": ["imdbspy"], "reason": "the movie half"})])
    out = observe_node(state)
    assert out["enabled_groups"] == ["core", "exercise", "imdbspy"]
    obs = out["observations"][0]
    assert obs["success"] and obs["result"]["granted"] == ["imdbspy"]
    assert "now available" in obs["summary"]
    assert out["selection"]["source"] == "model_request" and out["selection"]["selected"] == ["exercise", "imdbspy"]
    assert out["selection"]["reason"] == "the movie half"
    assert any(e == "tool_groups_selected" for e, _ in events)


def test_observe_denies_request_in_manual_mode_with_enable_action():
    state = _state(step_count=1, tool_selection="manual", enabled_groups=["core"],
                   pending_actions=[ToolCall(id="c1", name="request_tool_groups",
                                             arguments={"groups": ["imdbspy"]})])
    out = observe_node(state)
    obs = out["observations"][0]
    assert obs["success"] is False
    assert obs["result"]["code"] == "permission_denied"
    assert obs["result"]["details"] == {"action": "enable_tool_group", "group": "imdbspy",
                                        "tool": "request_tool_groups"}
    assert "enabled_groups" not in out


def test_observe_refuses_a_group_whose_requires_is_unmet(monkeypatch):
    monkeypatch.setattr("utils.agents.coordinator.graph.group_requires",
                        lambda g: "workspace" if g == "mailbox" else None)
    state = _state(step_count=1, enabled_groups=["core"],
                   pending_actions=[ToolCall(id="c1", name="request_tool_groups",
                                             arguments={"groups": ["mailbox"]})])
    out = observe_node(state)
    obs = out["observations"][0]
    assert obs["result"]["granted"] == [] and obs["result"]["refused"] == ["mailbox (requires workspace)"]
    assert "enabled_groups" not in out


def test_group_denial_in_auto_mode_tells_the_model_how_to_recover():
    state = _state(step_count=1, enabled_groups=["core"],
                   pending_actions=[ToolCall(id="c1", name="imdbspy_list_media", arguments={})])
    out = observe_node(state)
    obs = out["observations"][0]
    assert obs["result"]["details"]["action"] == "enable_tool_group"
    assert 'request_tool_groups with groups=["imdbspy"]' in obs["summary"]


def test_group_denial_in_manual_mode_is_unchanged():
    state = _state(step_count=1, tool_selection="manual", enabled_groups=["core"],
                   pending_actions=[ToolCall(id="c1", name="imdbspy_list_media", arguments={})])
    obs = observe_node(state)["observations"][0]
    assert "request_tool_groups" not in obs["summary"]


# --- route ---------------------------------------------------------------------------

def test_route_defaults_to_auto_and_pins_the_client_set():
    state, err = _build_initial_state({"message": "hi", "enabled_groups": ["core", "calendar"]})
    assert err is None
    assert state["tool_selection"] == "auto"
    assert state["pinned_groups"] == ["core", "calendar"] and state["enabled_groups"] == ["core", "calendar"]
    assert state["selection"] is None


def test_route_accepts_manual():
    state, _ = _build_initial_state({"message": "hi", "tool_selection": "manual"})
    assert state["tool_selection"] == "manual"
    state, _ = _build_initial_state({"message": "hi", "tool_selection": "bogus"})
    assert state["tool_selection"] == "auto"
