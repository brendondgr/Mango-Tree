"""The ``request_tool_groups`` core tool.

In automatic tool selection (docs/tool-groups.md, D16) the ``select`` node
picks the app groups a turn needs *before* the model reasons. This tool is the
model's way to correct a miss mid-turn: it asks for groups by id, and the
observe node — not this function — decides whether to grant them. In manual
mode the observe node denies the request with the ``enable_tool_group`` action
so the user's switch stays the authority.

The function itself only validates: it never mutates state, because the
enabled set lives in the graph state, not in the registry.
"""

from __future__ import annotations

from typing import Any, List

from utils.agents.schemas.agent import ToolResult
from utils.agents.tools.registry import registry


@registry.register("request_tool_groups")
def request_tool_groups(groups: Any = None, reason: str = "") -> ToolResult:
    from utils.agents.tools.groups import CORE_GROUP, all_group_ids, group_label

    if isinstance(groups, str):
        groups = [g.strip() for g in groups.split(",")]
    if not isinstance(groups, list) or not groups:
        return ToolResult(
            success=False,
            result={"error": {"code": "validation_error",
                              "message": "'groups' must be a non-empty list of tool group ids.",
                              "details": {"known": [g for g in all_group_ids() if g != CORE_GROUP]}}},
            summary="request_tool_groups: 'groups' must be a non-empty list of group ids.",
            artifact_ids=[],
        )
    known = {g.lower(): g for g in all_group_ids()}
    labels = {group_label(g).lower(): g for g in all_group_ids()}
    requested: List[str] = []
    unknown: List[str] = []
    for raw in groups:
        token = str(raw).strip().lower()
        match = known.get(token) or labels.get(token)
        if match is None or match == CORE_GROUP:
            unknown.append(str(raw))
        elif match not in requested:
            requested.append(match)
    if not requested:
        return ToolResult(
            success=False,
            result={"error": {"code": "validation_error",
                              "message": f"No known tool group in {groups}.",
                              "details": {"unknown": unknown,
                                          "known": [g for g in all_group_ids() if g != CORE_GROUP]}}},
            summary=f"request_tool_groups: none of {groups} is a known tool group.",
            artifact_ids=[],
        )
    return ToolResult(
        success=True,
        result={"requested": requested, "unknown": unknown, "reason": str(reason or "")},
        summary=f"Requested tool group(s): {', '.join(requested)}.",
        artifact_ids=[],
    )
