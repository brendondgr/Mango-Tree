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
    
    # 1. Text attachment
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
    assert len(formatted) == 1
    assert "Attached file: config.json" in formatted[0]["content"]
    assert '{"debug": true}' in formatted[0]["content"]

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
    assert len(formatted_bin) == 1
    assert "Attached file: clip.mp4 (Type: video, ID: art-uuid-abc)" in formatted_bin[0]["content"]


