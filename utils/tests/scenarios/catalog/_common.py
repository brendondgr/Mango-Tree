"""Small helpers shared by the catalog modules."""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from utils.agents.schemas.agent import AgentMessage


def approved(request: str, question: str, reply: str = "Yes, go ahead.") -> List[AgentMessage]:
    """A history in which the user already approved a destructive step.

    The destructive tools are gated in code by ``confirm: true``; the prompt tells
    the model to ask first. This is the conversation *after* it asked.
    """
    return [
        AgentMessage(role="user", content=request),
        AgentMessage(role="agent", content=question),
    ]


def find(items: List[Dict[str, Any]], **where) -> Dict[str, Any]:
    """First dict in ``items`` whose keys match ``where`` (raise if none)."""
    for item in items:
        if all(item.get(k) == v for k, v in where.items()):
            return item
    raise LookupError(f"no item matching {where} in {len(items)} items")


def has_key(*keys: str) -> Callable[[Dict[str, Any]], None]:
    def check(result: Dict[str, Any]) -> None:
        for key in keys:
            assert key in result, f"result lacks {key!r}: {sorted(result)}"
    return check
