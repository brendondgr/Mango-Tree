"""Automatic tool-group selection: the ``select`` node's router.

Given the conversation and the catalogue of app tool groups, one small model
call (no tools, temperature 0) answers *which groups this message needs*. The
answer is JSON; parsing is deliberately tolerant because the local models this
runs on wrap JSON in fences, prefix prose, or return a bare list. When nothing
parseable comes back, a keyword match over the groups' ``keywords`` stands in,
and the record says so — the decision is always attributable to a source.

The output of this module is a :class:`SelectionResult`; the graph turns it
into the turn's enabled set (``core`` + pinned + selected) and streams it to
the client as the ``tool_groups_selected`` event. Nothing here enforces
anything — assembly and execution gating stay in ``groups.py`` and the
registry, unchanged.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence

from utils.agents.providers.llm import stream_chat
from utils.agents.schemas.agent import AgentMessage
from utils.agents.tools import groups as tool_groups
from utils.shared.llm.kit.params import GenParams
from utils.shared.llm.kit.types import Message

#: How many recent messages the router sees for context. The latest message
#: is always included and marked; the rest only help resolve references.
CONTEXT_MESSAGES = 6

#: Output budget for the router. Generous on purpose: a reasoning model spends
#: part of it thinking before the JSON, and an empty reply costs a fallback.
ROUTER_MAX_TOKENS = 1500

#: Attribution of a selection decision.
SOURCE_MODEL = "model"
SOURCE_KEYWORDS = "keyword_fallback"
SOURCE_NONE = "no_candidates"
SOURCE_MANUAL = "manual"
SOURCE_REQUEST = "model_request"


@dataclass
class SelectionResult:
    selected: List[str]
    reason: str
    source: str
    candidates: List[str]
    raw_text: str = ""
    model: str = ""
    dropped: List[str] = field(default_factory=list)

    def to_record(self, pinned: Sequence[str], enabled: Sequence[str]) -> Dict[str, Any]:
        return {
            "groups": list(enabled),
            "pinned": list(pinned),
            "selected": list(self.selected),
            "candidates": list(self.candidates),
            "dropped": list(self.dropped),
            "reason": self.reason,
            "source": self.source,
            "model": self.model,
        }


# --- prompt --------------------------------------------------------------------

def catalogue_lines(candidates: Iterable[str]) -> List[str]:
    lines = []
    for group in candidates:
        tools = tool_groups.tool_groups().get(group, [])
        lines.append(
            f"- {group} ({tool_groups.group_label(group)}): {tool_groups.group_description(group)}"
            f" Tools: {', '.join(tools)}."
        )
    return lines


def build_selection_prompt(candidates: Sequence[str]) -> str:
    return (
        "You are the tool router for Mango, a local personal assistant. Decide which "
        "optional app tool groups the assistant needs to fulfil the user's LATEST message. "
        "Core tools (saved files, skills, chat context, web search) are always available "
        "and must not be selected.\n\n"
        "Available groups:\n" + "\n".join(catalogue_lines(candidates)) + "\n\n"
        "Rules:\n"
        "- Select a group only when a tool in it is needed to read or change that app's data "
        "for the latest message.\n"
        "- Select every group the request touches; one message can need several.\n"
        "- Small talk, thanks, follow-up questions answerable from the conversation, and "
        "questions about the assistant itself need no groups.\n"
        "- Use the earlier messages only to resolve what the latest message refers to.\n\n"
        'Reply with JSON only, no prose: {"groups": ["<id>", ...], "reason": "<one sentence>"}'
    )


def _role_name(role: str) -> str:
    return "assistant" if role == "agent" else role


def build_router_messages(
    messages: Sequence[AgentMessage], candidates: Sequence[str]
) -> List[Message]:
    recent = list(messages)[-CONTEXT_MESSAGES:]
    latest = latest_user_text(messages)
    transcript = "\n".join(
        f"{_role_name(m.role)}: {m.content.strip()}" for m in recent[:-1] if m.content.strip()
    )
    body = ""
    if transcript:
        body += "Earlier conversation:\n" + transcript + "\n\n"
    body += "Latest user message:\n" + latest
    return [Message.system(build_selection_prompt(candidates)), Message.user(body)]


def latest_user_text(messages: Sequence[AgentMessage]) -> str:
    for message in reversed(list(messages)):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    return ""


# --- parsing -------------------------------------------------------------------

_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def _candidate_json_blobs(text: str) -> Iterable[str]:
    for fenced in _FENCE.findall(text):
        yield fenced.strip()
    # Widest object, then widest array, then the bare text.
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            yield text[start:end + 1]
    yield text.strip()


def parse_selection(text: str, candidates: Sequence[str]) -> Optional[Dict[str, Any]]:
    """Recover ``{"groups": [...], "reason": str, "dropped": [...]}`` from model text.

    Returns ``None`` when no JSON object or list can be found — the caller then
    falls back to keywords. Unknown ids are dropped, not fatal, and reported.
    """
    if not text or not text.strip():
        return None
    for blob in _candidate_json_blobs(text):
        try:
            data = json.loads(blob)
        except (ValueError, TypeError):
            continue
        if isinstance(data, list):
            data = {"groups": data, "reason": ""}
        if not isinstance(data, dict):
            continue
        raw_groups = data.get("groups", data.get("tool_groups", []))
        if isinstance(raw_groups, str):
            raw_groups = [g for g in re.split(r"[,\s]+", raw_groups) if g]
        if not isinstance(raw_groups, list):
            continue
        groups, dropped = normalize_groups(raw_groups, candidates)
        reason = data.get("reason", "")
        return {"groups": groups, "reason": str(reason or "").strip(), "dropped": dropped}
    return None


def normalize_groups(raw: Iterable[Any], candidates: Sequence[str]):
    by_id = {g.lower(): g for g in candidates}
    by_label = {tool_groups.group_label(g).lower(): g for g in candidates}
    groups: List[str] = []
    dropped: List[str] = []
    for item in raw:
        token = str(item).strip().lower()
        match = by_id.get(token) or by_label.get(token)
        if match is None:
            if token:
                dropped.append(str(item))
        elif match not in groups:
            groups.append(match)
    return groups, dropped


def keyword_fallback(text: str, candidates: Sequence[str]) -> List[str]:
    haystack = " " + re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower()) + " "
    hits: List[str] = []
    for group in candidates:
        needles = [group.lower(), tool_groups.group_label(group).lower()] + tool_groups.group_keywords(group)
        if any(f" {needle} " in haystack for needle in needles if needle):
            hits.append(group)
    return hits


# --- the call ------------------------------------------------------------------

def select_tool_groups(
    messages: Sequence[AgentMessage],
    candidates: Sequence[str],
    llm_config: Optional[Dict[str, Any]] = None,
) -> SelectionResult:
    """Ask the model which of ``candidates`` the latest message needs.

    Raises :class:`~utils.agents.providers.llm.LLMProviderError` when the
    provider cannot be reached — the graph treats that exactly like a failed
    reasoning call (an ``error`` event, no fabricated answer).
    """
    candidates = list(candidates)
    if not candidates:
        return SelectionResult([], "no selectable groups", SOURCE_NONE, [])

    text_parts: List[str] = []
    model_id = ""
    for chunk in stream_chat(
        build_router_messages(messages, candidates),
        tools=None,
        config=llm_config,
        params=GenParams(temperature=0, max_tokens=ROUTER_MAX_TOKENS),
    ):
        if chunk.model:
            model_id = chunk.model
        if chunk.type == "text" and chunk.text:
            text_parts.append(chunk.text)
        elif chunk.type == "error":
            from utils.agents.providers.llm import LLMProviderError

            raise LLMProviderError(chunk.text or "The tool router's stream failed.",
                                   code="stream_error")
    raw = "".join(text_parts)

    parsed = parse_selection(raw, candidates)
    if parsed is not None:
        return SelectionResult(
            selected=parsed["groups"],
            reason=parsed["reason"] or ("no app tools needed" if not parsed["groups"] else "selected by the model"),
            source=SOURCE_MODEL, candidates=candidates, raw_text=raw, model=model_id,
            dropped=parsed["dropped"],
        )

    hits = keyword_fallback(latest_user_text(messages), candidates)
    return SelectionResult(
        selected=hits,
        reason=("router reply was not JSON; matched by keywords" if hits
                else "router reply was not JSON and no keyword matched"),
        source=SOURCE_KEYWORDS, candidates=candidates, raw_text=raw, model=model_id,
    )
