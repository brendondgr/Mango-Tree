"""Stage 1: tool-group metadata + loader (see docs/tool-groups.md)."""

import yaml
from pathlib import Path

from django.conf import settings

from utils.agents.tools import groups
from utils.agents.tools.registry import registry

CORE_TOOLS = {
    "list_artifacts",
    "read_artifact",
    "inspect_skills",
    "read_skill",
    "inspect_chat_context",
    "search_web",
}

APP_GROUPS = {
    "media_viewer",
    "mailbox",
    "calendar",
    "exercise",
    "projectmanager",
    "imdbspy",
    "recipes",
    "timekeeper",
}


def _raw_tools_config() -> dict:
    path = Path(settings.BASE_DIR) / "config" / "tools.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8"))["tools"]


def test_every_tool_resolves_to_exactly_one_group():
    all_tools = set(_raw_tools_config().keys())
    grouped = groups.tool_groups()

    # Every tool has a non-null group.
    for name in all_tools:
        assert groups.group_of(name) in grouped, name

    # The group -> tools map is a partition of all tools (no gaps, no dupes).
    flattened = [t for names in grouped.values() for t in names]
    assert sorted(flattened) == sorted(all_tools)
    assert len(flattened) == len(set(flattened))


def test_core_group_membership():
    assert set(groups.tool_groups()["core"]) == CORE_TOOLS
    assert len(groups.tool_groups()["core"]) == 6


def test_all_group_ids_and_ordering():
    ids = groups.all_group_ids()
    assert set(ids) == {"core"} | APP_GROUPS
    assert ids[0] == "core"  # core is always first


def test_default_enabled_is_core_only():
    assert groups.default_enabled_groups() == ["core"]


def test_unknown_and_normalize_helpers():
    assert groups.unknown_groups(["core", "bogus", "mailbox"]) == ["bogus"]
    assert groups.normalize_enabled_groups(["core", "core", "bogus", "mailbox"]) == [
        "core",
        "mailbox",
    ]


def test_schema_generated_for_every_tool():
    for name in _raw_tools_config():
        schema = groups.build_tool_schema(name)
        assert schema is not None, name
        fn = schema["function"]
        assert fn["name"] == name
        assert isinstance(fn["description"], str) and fn["description"]
        params = fn["parameters"]
        assert params["type"] == "object"
        assert isinstance(params["properties"], dict)
        # Injected DI seams must never leak into a schema.
        assert not (set(params["properties"]) & {"service", "scraper", "store"})


def test_introspected_schema_marks_required_and_optional():
    # mailbox_list_messages(*, account, folder="INBOX", limit=25, service=None)
    schema = groups.build_tool_schema("mailbox_list_messages")["function"]["parameters"]
    assert schema["properties"]["account"] == {"type": "string"}
    assert schema["properties"]["limit"] == {"type": "integer"}
    assert schema["required"] == ["account"]  # only the no-default param
    assert "service" not in schema["properties"]


def test_core_tool_uses_explicit_yaml_schema():
    schema = groups.build_tool_schema("read_artifact")["function"]["parameters"]
    assert schema["required"] == ["artifact_id"]
    assert schema["properties"]["artifact_id"]["type"] == "string"


def test_build_tool_schemas_filters_by_group():
    core_only = groups.build_tool_schemas(["core"])
    names = {s["function"]["name"] for s in core_only}
    assert names == CORE_TOOLS

    with_mailbox = groups.build_tool_schemas(["core", "mailbox"])
    names = {s["function"]["name"] for s in with_mailbox}
    assert "mailbox_send_message" in names
    assert names >= CORE_TOOLS


def test_group_metadata_shape():
    meta = {g["id"]: g for g in groups.group_metadata()}
    assert meta["core"]["default_enabled"] is True
    assert meta["mailbox"]["default_enabled"] is False
    assert meta["mailbox"]["label"] == "Mailbox"
    assert "mailbox_send_message" in meta["mailbox"]["tools"]
    # No group declares a precondition today.
    assert all("requires" not in g for g in meta.values())


def test_app_tools_registered_into_registry():
    # Importing utils.agents.tools.groups wires the app tools into the registry.
    for name in ("mailbox_list_messages", "calendar_get_day", "timekeeper_daily_totals"):
        assert name in registry._tools, name
    # Core tools are still registered by their decorators.
    assert "read_skill" in registry._tools
