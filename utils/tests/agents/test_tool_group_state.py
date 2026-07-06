"""Stage 2: session tool state (enabled_groups / workspace_id) + turn validation."""

from utils.agents.tools import groups
from utils.api.routes.agent import _build_initial_state, run_agent_turn
from rest_framework.test import APIRequestFactory


# --- resolve_enabled_groups (pure) -------------------------------------------

def test_absent_groups_fall_back_to_default():
    resolved, err = groups.resolve_enabled_groups(None)
    assert err is None
    assert resolved == ["core"]


def test_non_list_is_validation_error():
    resolved, err = groups.resolve_enabled_groups("core")
    assert resolved is None
    assert err["code"] == "validation_error"


def test_unknown_group_is_validation_error():
    resolved, err = groups.resolve_enabled_groups(["core", "bogus"])
    assert resolved is None
    assert err["code"] == "validation_error"
    assert err["details"]["unknown"] == ["bogus"]


def test_valid_groups_normalized():
    resolved, err = groups.resolve_enabled_groups(["mailbox", "mailbox", "core"])
    assert err is None
    assert resolved == ["mailbox", "core"]  # order preserved, de-duped


def test_requires_unmet_is_permission_denied(monkeypatch):
    monkeypatch.setattr(
        groups, "group_requires", lambda g: "workspace" if g == "mailbox" else None
    )
    resolved, err = groups.resolve_enabled_groups(["core", "mailbox"], capabilities=set())
    assert resolved is None
    assert err["code"] == "permission_denied"
    assert err["details"]["action"] == "enable_tool_group"
    assert err["details"]["group"] == "mailbox"
    assert err["details"]["requires"] == "workspace"


def test_requires_met_when_capability_present(monkeypatch):
    monkeypatch.setattr(
        groups, "group_requires", lambda g: "workspace" if g == "mailbox" else None
    )
    resolved, err = groups.resolve_enabled_groups(
        ["core", "mailbox"], capabilities={"workspace"}
    )
    assert err is None
    assert resolved == ["core", "mailbox"]


# --- initial-state builder ----------------------------------------------------

def test_build_initial_state_carries_groups_and_workspace():
    state, err = _build_initial_state(
        {"message": "hi", "enabled_groups": ["core", "mailbox"], "workspace_id": "ws-9"}
    )
    assert err is None
    assert state["enabled_groups"] == ["core", "mailbox"]
    assert state["workspace_id"] == "ws-9"


def test_build_initial_state_defaults_when_absent():
    state, err = _build_initial_state({"message": "hi"})
    assert err is None
    assert state["enabled_groups"] == ["core"]
    assert state["workspace_id"] is None


def test_build_initial_state_rejects_unknown_group():
    state, err = _build_initial_state({"message": "hi", "enabled_groups": ["bogus"]})
    assert state is None
    assert err["code"] == "validation_error"


# --- route early-return (auth relaxed in this suite by conftest) ---------------

def test_route_rejects_unknown_group_before_streaming():
    request = APIRequestFactory().post(
        "/api/agent/s1/agent_turn/",
        {"message": "hi", "enabled_groups": ["core", "bogus"]},
        format="json",
    )
    response = run_agent_turn(request, session_id="s1")
    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert "bogus" in response.data["details"]["unknown"]
