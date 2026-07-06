"""Stage 3: conditional schema + prompt assembly in the coordinator."""

from unittest.mock import MagicMock, patch

from utils.agents.coordinator.graph import build_system_prompt, reason_node
from utils.agents.schemas.agent import AgentMessage
from utils.agents.tools.groups import build_tool_schemas
from utils.apps.mailbox.agent.prompts import MAILBOX_TOOLS_PROMPT


def _schema_names(enabled_groups):
    return {s["function"]["name"] for s in build_tool_schemas(enabled_groups)}


def test_core_only_excludes_app_schemas_and_prompt():
    names = _schema_names(["core"])
    assert not any(n.startswith("mailbox_") for n in names)
    prompt = build_system_prompt("auto", ["core"])
    assert MAILBOX_TOOLS_PROMPT.strip()[:40] not in prompt


def test_mailbox_enabled_includes_mailbox_schema_and_prompt():
    names = _schema_names(["core", "mailbox"])
    assert "mailbox_send_message" in names
    assert {"list_artifacts", "search_web"} <= names  # core still present
    prompt = build_system_prompt("auto", ["core", "mailbox"])
    assert MAILBOX_TOOLS_PROMPT.strip()[:40] in prompt


def _run_reason_with_groups(enabled_groups):
    with patch("utils.agents.coordinator.graph.chat_complete") as mock_cc:
        stream = MagicMock()
        stream.iter_lines.return_value = [b"data: [DONE]"]
        mock_cc.return_value = stream
        state = {
            "messages": [AgentMessage(role="user", content="hi")],
            "step_count": 0,
            "max_steps": 6,
            "pending_actions": [],
            "observations": [],
            "final_answer": None,
            "error": None,
            "web_search_mode": "auto",
            "enabled_groups": enabled_groups,
            "callback": None,
        }
        reason_node(state)
        tools = mock_cc.call_args.kwargs["tools"]
        return {t["function"]["name"] for t in tools}


def test_reason_node_sends_only_enabled_group_schemas():
    core_only = _run_reason_with_groups(["core"])
    assert not any(n.startswith("mailbox_") for n in core_only)
    assert "search_web" in core_only

    with_mailbox = _run_reason_with_groups(["core", "mailbox"])
    assert "mailbox_send_message" in with_mailbox


def test_reason_node_without_enabled_groups_defaults_to_core():
    # Back-compat: a state that never set enabled_groups uses the default set.
    with patch("utils.agents.coordinator.graph.chat_complete") as mock_cc:
        stream = MagicMock()
        stream.iter_lines.return_value = [b"data: [DONE]"]
        mock_cc.return_value = stream
        state = {
            "messages": [AgentMessage(role="user", content="hi")],
            "step_count": 0,
            "max_steps": 6,
            "pending_actions": [],
            "observations": [],
            "final_answer": None,
            "error": None,
            "web_search_mode": "auto",
            "callback": None,
        }
        reason_node(state)
        names = {t["function"]["name"] for t in mock_cc.call_args.kwargs["tools"]}
    assert "search_web" in names
    assert not any(n.startswith("mailbox_") for n in names)
