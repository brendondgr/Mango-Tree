import pytest
from unittest.mock import patch
import requests
from agents.coordinator.graph import agent_graph
from agents.schemas.agent import AgentMessage
from agents.tools.registry import registry

@patch("requests.post")
def test_coordinator_graph_flow(mock_post):
    # Force requests.post to raise ConnectionError to reliably trigger fallback simulation
    mock_post.side_effect = requests.exceptions.ConnectionError("Connection refused")
    
    # Construct initial state
    initial_state = {
        "messages": [AgentMessage(role="user", content="scan available skills")],
        "step_count": 0,
        "max_steps": 6,
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "callback": None
    }
    
    # We execute the graph (which should trigger the fallback simulation since LLM is offline)
    result = agent_graph.invoke(initial_state)
    
    # Verify execution updates
    assert result is not None
    assert result["step_count"] > 0
    assert len(result["observations"]) > 0
    assert result["final_answer"] is not None
    
    # The first observation should be from inspect_skills
    first_obs = result["observations"][0]
    assert first_obs["tool"] == "inspect_skills"
    assert first_obs["success"] is True
    assert "skills" in first_obs["result"]
    assert isinstance(first_obs["result"]["skills"], list)
    
    # It should only find skills under agents/skills/, which currently contains artifacts/SKILL.md
    skills = first_obs["result"]["skills"]
    assert "artifacts/SKILL.md" in skills
    # Internal developer docs (like django-backend) must NOT be present
    assert "django-backend/SKILL.md" not in skills

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


def test_format_messages_with_attachments():
    from agents.coordinator.graph import format_messages_for_llm
    
    # 1. Text attachment — system prompt is at [0], user message at [1]
    msg_text = AgentMessage(
        role="user",
        content="Check this config",
        attachments=[
            {
                "name": "config.json",
                "kind": "text",
                "id": "att-123",
                "textContent": '{"debug": true}'
            }
        ]
    )
    formatted = format_messages_for_llm([msg_text], [])
    assert formatted[0]["role"] == "system"  # System prompt
    assert len(formatted) == 2
    assert "Attached file: config.json" in formatted[1]["content"]
    assert '{"debug": true}' in formatted[1]["content"]

    # 2. Binary/Video attachment
    msg_bin = AgentMessage(
        role="user",
        content="What is this video?",
        attachments=[
            {
                "name": "clip.mp4",
                "kind": "video",
                "id": "att-456",
                "artifactId": "art-uuid-abc"
            }
        ]
    )
    formatted_bin = format_messages_for_llm([msg_bin], [])
    assert len(formatted_bin) == 2
    assert "Attached file: clip.mp4 (Type: video, ID: art-uuid-abc)" in formatted_bin[1]["content"]


def test_format_messages_with_media_observations():
    from agents.coordinator.graph import format_messages_for_llm
    
    msg = AgentMessage(role="user", content="Examine this image")
    observations = [{
        "tool": "read_artifact",
        "call_id": "call_1",
        "success": True,
        "result": {
            "metadata": {"filename": "test.png"},
            "media_base64": "iVBORw0KGgo=",  # Tiny stub
            "media_type": "image",
            "mime_type": "image/png",
            "content": "[Image loaded: test.png (77 bytes)]"
        },
        "summary": "Successfully loaded image test.png",
        "artifact_ids": ["some-id"]
    }]
    
    formatted = format_messages_for_llm([msg], observations)
    # Should have: system prompt, user message, multimodal observation message
    assert len(formatted) == 3
    obs_msg = formatted[2]
    assert obs_msg["role"] == "user"
    # Content should be a list of content parts (multimodal)
    assert isinstance(obs_msg["content"], list)
    # Should contain at least one image_url block
    image_parts = [p for p in obs_msg["content"] if p.get("type") == "image_url"]
    assert len(image_parts) >= 1
    assert "data:image/png;base64," in image_parts[0]["image_url"]["url"]


def test_read_artifact_returns_media_for_image():
    # Test that reading an image artifact returns media_base64 data
    result = registry.execute("read_artifact", {"artifact_id": "_test.png"})
    assert result.success is True
    assert "media_base64" in result.result
    assert result.result["media_type"] == "image"
    assert result.result["mime_type"].startswith("image/")
    assert "loaded" in result.summary.lower()


def test_read_artifact_returns_media_for_video():
    # Test that reading a video artifact returns media_base64 data
    result = registry.execute("read_artifact", {"artifact_id": "1402.mp4"})
    assert result.success is True
    assert "media_base64" in result.result
    assert result.result["media_type"] == "video"
    assert result.result["mime_type"].startswith("video/")
    assert "loaded" in result.summary.lower()


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
    from agents.coordinator.graph import observe_node
    from agents.schemas.agent import ToolCall
    
    # Simulate a state where read_artifact was already called with a specific ID
    state = {
        "messages": [AgentMessage(role="user", content="test")],
        "step_count": 1,
        "max_steps": 6,
        "pending_actions": [
            ToolCall(id="call_dup", name="read_artifact", arguments={"artifact_id": "_test.png"})
        ],
        "observations": [
            {
                "tool": "read_artifact",
                "call_id": "call_original",
                "success": True,
                "result": {"content": "[Image loaded]"},
                "summary": "Already loaded",
                "artifact_ids": [],
                "_arguments": {"artifact_id": "_test.png"}
            }
        ],
        "final_answer": None,
        "error": None,
        "callback": None
    }
    
    result = observe_node(state)
    
    # The duplicate should be skipped
    new_obs = result["observations"]
    dup_obs = [o for o in new_obs if o.get("call_id") == "call_dup"]
    assert len(dup_obs) == 1
    assert dup_obs[0]["success"] is False
    assert "Skipped duplicate" in dup_obs[0]["summary"]
