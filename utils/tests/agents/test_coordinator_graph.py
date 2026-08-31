"""The coordinator loop: message assembly, tool correlation, and honest errors."""

from unittest.mock import patch

from utils.agents.coordinator.graph import (
    agent_graph,
    collect_references,
    format_messages_for_llm,
    observation_turns,
    observe_node,
    reason_node,
)
from utils.agents.providers.llm import LLMProviderError
from utils.agents.schemas.agent import AgentMessage
from utils.agents.tools.registry import registry
from utils.shared.llm.kit.types import ImagePart, StreamChunk, TextPart
from utils.shared.llm.kit.types import ToolCall as LlmToolCall


# --- helpers ------------------------------------------------------------------

def _turn(text="", thinking="", calls=(), raw=None):
    """One provider turn as the normalized chunks an adapter would emit."""
    chunks = [StreamChunk(type="start", model="test-model")]
    if thinking:
        chunks.append(StreamChunk(type="thinking", text=thinking, model="test-model"))
    if text:
        chunks.append(StreamChunk(type="text", text=text, model="test-model"))
    for call in calls:
        chunks.append(StreamChunk(type="tool_call", tool_call=call, model="test-model"))
    chunks.append(
        StreamChunk(type="done", finish_reason="stop", model="test-model", raw=raw)
    )
    return chunks


def _state(**kw):
    state = {
        "messages": [AgentMessage(role="user", content="scan available skills")],
        "step_count": 0,
        "max_steps": 6,
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "llm_turns": [],
        "web_search_mode": "auto",
        "enabled_groups": None,
        "callback": None,
    }
    state.update(kw)
    return state


def _recorder():
    events = []
    return events, lambda event, payload: events.append((event, payload))


# --- the loop -----------------------------------------------------------------

def test_coordinator_graph_flow():
    """reason -> act -> observe -> reason -> respond against a scripted provider."""
    call = LlmToolCall(id="call_1", name="inspect_skills", arguments={})
    with patch(
        "utils.agents.coordinator.graph.stream_chat",
        side_effect=[_turn(calls=[call]), _turn(text="Here are the skills.")],
    ):
        result = agent_graph.invoke(_state())

    assert result["step_count"] > 0
    assert result["error"] is None
    assert result["final_answer"] == "Here are the skills."

    first_obs = result["observations"][0]
    assert first_obs["tool"] == "inspect_skills"
    assert first_obs["success"] is True
    skills = first_obs["result"]["skills"]
    assert isinstance(skills, list)
    # It should only find skills under agents/skills/, which currently contains
    # artifacts/SKILL.md; internal developer docs must NOT be present.
    assert "artifacts/SKILL.md" in skills
    assert "django-backend/SKILL.md" not in skills


def test_tool_result_is_replayed_against_the_call_that_asked_for_it():
    """Defect 1: the result must carry the call id, and the assistant turn that
    made the call must be replayed verbatim rather than rebuilt from strings."""
    call = LlmToolCall(id="call_abc", name="inspect_skills", arguments={})
    seen = []

    def fake_stream(messages, tools=None, config=None, **kw):
        seen.append(list(messages))
        return _turn(calls=[call]) if len(seen) == 1 else _turn(text="done")

    with patch("utils.agents.coordinator.graph.stream_chat", side_effect=fake_stream):
        result = agent_graph.invoke(_state())

    turns = result["llm_turns"]
    assistant = turns[0]
    tool_turn = turns[1]
    assert assistant.role == "assistant"
    assert [c.id for c in assistant.tool_calls] == ["call_abc"]
    assert tool_turn.role == "tool"
    assert tool_turn.tool_results[0].tool_call_id == "call_abc"
    assert tool_turn.tool_results[0].name == "inspect_skills"

    # Second iteration replays the provider's OWN assistant item — the same
    # object, so Anthropic thinking signatures / Gemini thought signatures ride
    # along instead of being dropped.
    second_pass = seen[1]
    assert second_pass[-2] is assistant      # identity, not a rebuilt copy
    assert second_pass[-1] is tool_turn
    # ...and nothing re-narrates the results as a system message.
    assert not any(
        m.role == "system" and "previously executed tools" in str(m.content)
        for m in second_pass
    )


def test_reasoning_blocks_survive_the_round_trip():
    """Anthropic 400s if a thinking block is dropped between a tool call and its
    result, so the provider's native blocks ride along on the replayed turn."""

    class _Block:
        type = "thinking"

        def model_dump(self):
            return {"type": "thinking", "thinking": "...", "signature": "sig-xyz"}

    class _Raw:
        content = [_Block()]

    call = LlmToolCall(id="toolu_1", name="inspect_skills", arguments={})
    with patch(
        "utils.agents.coordinator.graph.stream_chat",
        side_effect=[
            _turn(thinking="hmm", calls=[call], raw=_Raw()),
            _turn(text="done"),
        ],
    ):
        result = agent_graph.invoke(_state())

    assistant = result["llm_turns"][0]
    assert assistant.thinking == "hmm"
    assert assistant.thinking_raw and assistant.thinking_raw[0].model_dump()["signature"] == "sig-xyz"


def test_a_call_without_an_id_gets_one_on_both_sides():
    """Some servers omit the id. Whatever we execute under must be the id the
    replayed assistant turn carries, or the pair stops matching."""
    call = LlmToolCall(id="", name="inspect_skills", arguments={})
    with patch(
        "utils.agents.coordinator.graph.stream_chat",
        side_effect=[_turn(calls=[call]), _turn(text="done")],
    ):
        result = agent_graph.invoke(_state())

    assistant, tool_turn = result["llm_turns"][0], result["llm_turns"][1]
    assert assistant.tool_calls[0].id
    assert tool_turn.tool_results[0].tool_call_id == assistant.tool_calls[0].id


def test_provider_error_surfaces_instead_of_a_fabricated_answer():
    """Defect 2: a 401 must not render as a confident-sounding success."""
    events, callback = _recorder()
    failure = LLMProviderError(
        "'Anthropic' rejected the API key. Check it in Settings -> LLM.",
        code="auth_error",
        provider="anthropic",
        model="claude-x",
    )
    with patch("utils.agents.coordinator.graph.stream_chat", side_effect=failure):
        result = agent_graph.invoke(_state(callback=callback))

    assert result["error"] == failure.message
    assert result["final_answer"] is None
    assert result["observations"] == []
    assert result["llm_turns"] == []

    kinds = [name for name, _ in events]
    assert "error" in kinds
    assert "final_answer" not in kinds        # nothing invented on top of the failure
    payload = dict(events[kinds.index("error")][1])
    assert payload["code"] == "auth_error"
    assert payload["provider"] == "anthropic"
    # No simulated narration, and no tool call conjured out of nowhere.
    assert not any(name == "tool_call" for name, _ in events)
    assert not any(
        "Simulat" in str(p.get("content", "")) for name, p in events if name == "thinking_delta"
    )


def test_streamed_text_and_reasoning_both_reach_the_client():
    events, callback = _recorder()
    with patch(
        "utils.agents.coordinator.graph.stream_chat",
        side_effect=[_turn(text="answer", thinking="pondering")],
    ):
        reason_node(_state(callback=callback))
    deltas = [p["content"] for name, p in events if name == "thinking_delta"]
    assert deltas == ["pondering", "answer"]


# --- message assembly ---------------------------------------------------------

def test_format_messages_with_attachments():
    # 1. Text attachment — system prompt is at [0], user message at [1]
    msg_text = AgentMessage(
        role="user",
        content="Check this config",
        attachments=[
            {
                "name": "config.json",
                "kind": "text",
                "id": "att-123",
                "textContent": '{"debug": true}',
            }
        ],
    )
    formatted = format_messages_for_llm([msg_text], [])
    assert formatted[0].role == "system"  # System prompt
    assert len(formatted) == 2
    assert "Attached file: config.json" in formatted[1].content
    assert '{"debug": true}' in formatted[1].content

    # 2. Binary/Video attachment
    msg_bin = AgentMessage(
        role="user",
        content="What is this video?",
        attachments=[
            {
                "name": "clip.mp4",
                "kind": "video",
                "id": "att-456",
                "artifactId": "art-uuid-abc",
            }
        ],
    )
    formatted_bin = format_messages_for_llm([msg_bin], [])
    assert len(formatted_bin) == 2
    assert "Attached file: clip.mp4 (Type: video, ID: art-uuid-abc)" in formatted_bin[1].content


def test_agent_history_becomes_an_assistant_turn():
    formatted = format_messages_for_llm(
        [AgentMessage(role="user", content="hi"), AgentMessage(role="agent", content="hello")],
        [],
    )
    assert [m.role for m in formatted] == ["system", "user", "assistant"]


def test_media_result_rides_in_its_own_turn_after_the_tool_result():
    """An image cannot live inside a tool-result block on an OpenAI-compatible
    server, and must not push the tool_result out of first position on
    Anthropic — so it follows in a user turn of its own."""
    obs = {
        "tool": "read_artifact",
        "call_id": "call_1",
        "success": True,
        "result": {
            "metadata": {"filename": "test.png"},
            "media_base64": "iVBORw0KGgo=",  # Tiny stub
            "media_type": "image",
            "mime_type": "image/png",
            "content": "[Image loaded: test.png (77 bytes)]",
        },
        "summary": "Successfully loaded image test.png",
        "artifact_ids": ["some-id"],
    }

    tool_turn, media_turns = observation_turns(obs)
    assert tool_turn.role == "tool"
    assert tool_turn.tool_results[0].tool_call_id == "call_1"
    # The blob never goes into the tool-result text.
    assert "iVBORw0KGgo=" not in tool_turn.tool_results[0].content
    assert "test.png" in tool_turn.tool_results[0].content

    assert len(media_turns) == 1
    parts = media_turns[0].content
    assert media_turns[0].role == "user"
    assert isinstance(parts[0], TextPart)
    images = [p for p in parts if isinstance(p, ImagePart)]
    assert len(images) == 1
    assert images[0].mime_type == "image/png"
    assert images[0].data  # decoded bytes, re-encoded per provider by the adapter


def test_failed_tool_result_is_flagged_as_an_error():
    tool_turn, _ = observation_turns(
        {
            "tool": "read_artifact",
            "call_id": "c1",
            "success": False,
            "result": {"error": "nope"},
            "summary": "Tool failed",
        }
    )
    assert tool_turn.tool_results[0].is_error is True


# --- tools and references -----------------------------------------------------

def test_read_skill_tool():
    # Test reading the artifacts skill directly through the tool registry
    result = registry.execute("read_skill", {"skill_name": "artifacts"})
    assert result.success is True
    assert "skill_name" in result.result
    assert "content" in result.result
    assert "workspace" in result.result["content"]


def test_read_artifact_by_filename():
    # Test reading an artifact using its filename rather than its UUID
    result = registry.execute("read_artifact", {"artifact_id": "1402.mp4"})

    # It should either read successfully (if file exists) or fail with content missing.
    # Crucially, it must NOT fail with "not found in manifest".
    assert "not found in manifest" not in result.summary
    assert "metadata" in result.result
    assert result.result["metadata"]["filename"] == "1402.mp4"


def test_read_artifact_returns_media_for_image():
    # Test that reading an image artifact returns media_base64 data
    result = registry.execute("read_artifact", {"artifact_id": "_test.png"})
    assert result.success is True
    assert "media_base64" in result.result
    assert result.result["media_type"] == "image"
    assert result.result["mime_type"].startswith("image/")
    assert "loaded" in result.summary.lower()


def test_read_artifact_returns_media_for_video():
    # Test that reading a video artifact returns a JPEG poster frame (not raw video bytes).
    # The backend extracts a still frame via cv2 and sends it as image/jpeg,
    # exactly matching what the frontend canvas does for direct chat uploads.
    result = registry.execute("read_artifact", {"artifact_id": "1402.mp4"})
    assert result.success is True
    assert "media_base64" in result.result
    # Frame is always sent as image/jpeg regardless of source format
    assert result.result["media_type"] == "image"
    assert result.result["mime_type"] == "image/jpeg"
    assert "frame" in result.summary.lower() or "loaded" in result.summary.lower()


def test_missing_arguments_graceful_error():
    # Calling read_artifact with no arguments should fail gracefully
    res_art = registry.execute("read_artifact", {})
    assert res_art.success is False
    assert "required argument but was not provided" in res_art.summary

    # Calling read_skill with no arguments should fail gracefully
    res_skill = registry.execute("read_skill", {})
    assert res_skill.success is False
    assert "required argument but was not provided" in res_skill.summary


def test_observe_node_deduplicates_tool_calls():
    from utils.agents.schemas.agent import ToolCall

    # Simulate a state where read_artifact was already called with a specific ID
    state = _state(
        step_count=1,
        messages=[AgentMessage(role="user", content="test")],
        pending_actions=[
            ToolCall(id="call_dup", name="read_artifact", arguments={"artifact_id": "_test.png"})
        ],
        observations=[
            {
                "tool": "read_artifact",
                "call_id": "call_original",
                "success": True,
                "result": {"content": "[Image loaded]"},
                "summary": "Already loaded",
                "artifact_ids": [],
                "_arguments": {"artifact_id": "_test.png"},
            }
        ],
    )

    result = observe_node(state)

    # The duplicate should be skipped
    new_obs = result["observations"]
    dup_obs = [o for o in new_obs if o.get("call_id") == "call_dup"]
    assert len(dup_obs) == 1
    assert dup_obs[0]["success"] is False
    assert "Skipped duplicate" in dup_obs[0]["summary"]
    # ...and the model is still told, keyed to the call it made.
    assert result["llm_turns"][0].tool_results[0].tool_call_id == "call_dup"


def test_collect_references_dedupes_urls():
    observations = [
        {
            "tool": "search_web",
            "success": True,
            "result": {
                "sources": [
                    {"index": 1, "title": "A", "url": "https://a.test"},
                    {"index": 2, "title": "B", "url": "https://b.test"},
                ]
            },
        },
        {
            "tool": "search_web",
            "success": True,
            "result": {
                "sources": [
                    {"index": 1, "title": "A dup", "url": "https://a.test"},
                ]
            },
        },
    ]

    refs = collect_references(observations)
    assert len(refs) == 2
    assert refs[0]["index"] == 1
    assert refs[1]["index"] == 2


def test_forced_web_search_injects_search_web():
    with patch(
        "utils.agents.coordinator.graph.stream_chat",
        side_effect=[_turn(text="Answer without search.")],
    ):
        result = reason_node(
            _state(
                messages=[AgentMessage(role="user", content="What is the latest Django LTS?")],
                web_search_mode="forced",
            )
        )

    assert result["final_answer"] is None
    assert len(result["pending_actions"]) == 1
    action = result["pending_actions"][0]
    assert action.name == "search_web"
    assert action.arguments["query"] == "What is the latest Django LTS?"
    # The injected call joins the stored assistant turn, so the result that comes
    # back is correlated like any other rather than orphaned.
    assistant = result["llm_turns"][-1]
    assert [c.id for c in assistant.tool_calls] == [action.id]
