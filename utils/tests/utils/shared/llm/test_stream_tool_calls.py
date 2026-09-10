"""Streaming tool-call slots: what becomes a call and what is dropped."""

from utils.shared.llm.kit.providers.openai_like import _tool_call_chunks


def _slots(*entries):
    return {i: dict(entry) for i, entry in enumerate(entries)}


def test_nameless_slot_is_dropped():
    partial = _slots(
        {"id": "", "name": "", "args": "{}"},
        {"id": "c1", "name": "exercise_list_history", "args": "{}"},
    )
    chunks = list(_tool_call_chunks(partial, "m"))
    assert [c.tool_call.name for c in chunks] == ["exercise_list_history"]


def test_unparseable_arguments_keep_the_raw_text():
    partial = _slots({"id": "c1", "name": "exercise_list_history", "args": "{}{}"})
    (chunk,) = list(_tool_call_chunks(partial, "m"))
    assert chunk.tool_call.arguments == {"_parse_error": True, "_raw": "{}{}"}


def test_well_formed_slot_parses():
    partial = _slots({"id": "c1", "name": "recipes_get_recipe", "args": '{"recipe_id": "r1"}'})
    (chunk,) = list(_tool_call_chunks(partial, "m"))
    assert chunk.tool_call.arguments == {"recipe_id": "r1"}
    assert chunk.type == "tool_call"
