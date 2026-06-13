import pytest
from agents.coordinator.graph import agent_graph
from agents.schemas.agent import AgentMessage
from agents.tools.registry import registry

def test_coordinator_graph_flow():
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

