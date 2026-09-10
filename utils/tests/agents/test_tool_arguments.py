"""Malformed argument JSON is refused before a tool ever runs."""

import utils.agents.tools.groups  # noqa: F401 - registers the app tools
from utils.agents.tools.registry import registry


def test_parse_error_sentinel_is_refused_with_a_typed_envelope():
    res = registry.execute(
        "exercise_list_history",
        {"_parse_error": True, "_raw": "{}{}"},
        enabled_groups=["core", "exercise"],
    )
    assert res.success is False
    assert res.result["error"]["code"] == "invalid_arguments"
    assert res.result["error"]["details"]["raw"] == "{}{}"
    # The tool never ran, so there is no exception envelope.
    assert "traceback" not in res.result


def test_parse_error_never_reaches_the_tool_as_keywords():
    calls = []
    registry.register("scn_args_probe")(lambda **kw: calls.append(kw))
    try:
        registry.execute("scn_args_probe", {"_parse_error": True, "_raw": "oops"})
    finally:
        registry._tools.pop("scn_args_probe", None)
    assert calls == []


def test_non_dict_arguments_do_not_crash_the_registry():
    res = registry.execute("read_skill", None, enabled_groups=["core"])
    # No arguments at all: the tool's own signature decides, not a TypeError
    # about splatting None.
    assert isinstance(res.summary, str)


def test_group_gate_still_fires_before_the_argument_check():
    res = registry.execute(
        "exercise_list_history",
        {"_parse_error": True, "_raw": "{}{}"},
        enabled_groups=["core"],
    )
    assert res.result["code"] == "permission_denied"
