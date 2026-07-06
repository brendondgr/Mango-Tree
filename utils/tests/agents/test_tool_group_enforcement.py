"""Stage 4: execution-side tool-group enforcement in the registry."""

import utils.agents.tools.groups  # noqa: F401 - registers the app tools
from utils.agents.tools.registry import registry


def test_disabled_tool_is_denied_with_stable_action():
    res = registry.execute("mailbox_list_accounts", {}, enabled_groups=["core"])
    assert res.success is False
    assert res.result["code"] == "permission_denied"
    assert res.result["details"]["action"] == "enable_tool_group"
    assert res.result["details"]["group"] == "mailbox"
    assert res.result["details"]["tool"] == "mailbox_list_accounts"


def test_enabled_tool_passes_the_gate():
    res = registry.execute("mailbox_list_accounts", {}, enabled_groups=["core", "mailbox"])
    # It ran (the group gate did not fire); result is not a group denial.
    action = res.result.get("details", {}).get("action") if isinstance(res.result, dict) else None
    assert action != "enable_tool_group"


def test_none_enabled_groups_skips_the_gate():
    # Back-compat: callers that don't pass enabled_groups are ungated.
    res = registry.execute("read_skill", {"skill_name": "artifacts"})
    assert res.success is True


def test_core_tool_allowed_when_core_enabled():
    res = registry.execute("read_skill", {"skill_name": "artifacts"}, enabled_groups=["core"])
    assert res.success is True


def test_unknown_tool_still_reports_not_found():
    res = registry.execute("nope_does_not_exist", {}, enabled_groups=["core"])
    assert res.success is False
    assert "not found" in res.summary.lower()
