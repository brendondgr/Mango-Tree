"""The coordinator loop: reason -> act -> observe -> respond.

The loop talks to models through ``utils.agents.providers.llm``, which resolves
a provider server-side and yields normalized stream chunks. Two properties of
this file are load-bearing and easy to break:

* **Call/result correlation is preserved verbatim.** The assistant turn the
  provider actually produced is kept in ``state["llm_turns"]`` and replayed on
  the next iteration, rather than being rebuilt from strings. That is what
  carries Anthropic thinking-block signatures and Gemini thought signatures
  across a tool call — dropping them is a hard 400, not a degradation. Tool
  output goes back as a real tool-result turn keyed by ``tool_call_id``.
* **A provider failure is an error, never an answer.** There is no fallback
  narration: if the model cannot be reached, or the key is wrong, the turn ends
  with an ``error`` event and no ``final_answer``.
"""

import base64
import json
from typing import Any, Dict, List, Optional, Tuple

from langgraph.graph import StateGraph, END

from utils.agents.coordinator import selection as selection_module
from utils.agents.coordinator.state import AgentState
from utils.agents.providers.llm import LLMProviderError, stream_chat
from utils.agents.schemas.agent import AgentMessage, ToolCall, ToolResult
from utils.agents.tools.groups import (
    CORE_GROUP,
    build_tool_schemas,
    default_enabled_groups,
    group_description,
    group_label,
    group_requires,
    selectable_groups,
    tools_prompt_for,
)
from utils.agents.tools.registry import registry
from utils.shared.llm.kit.types import (
    ChatResponse,
    ImagePart,
    Message,
    TextPart,
)
from utils.shared.llm.kit.types import ToolCall as LlmToolCall
from utils.shared.llm.kit.types import ToolResult as LlmToolResult

# Tool schemas are assembled per turn from the session's enabled groups as
# neutral ``ToolDef``s — each adapter spells them in its own dialect. See
# ``build_tool_schemas`` in ``utils.agents.tools.groups`` and docs/tool-groups.md.

#: Cap on the text of one tool result fed back to the model.
MAX_RESULT_CHARS = 4000

SYSTEM_PROMPT_BASE = (
    "You are Mango, a helpful assistant. Follow these rules strictly:\n"
    "1. NEVER fabricate, invent, or hallucinate information about files you have not actually read. "
    "If a tool returns 'content omitted' or 'cannot be displayed', say so honestly.\n"
    "2. When you receive image data from a tool result, describe what you actually see in the image.\n"
    "3. Every tool result you receive is linked to the call that produced it. "
    "Do not repeat a call you have already made with the same arguments — its result is already above.\n"
    "4. Only call tools that are directly relevant to the user's request. "
    "Do NOT speculatively call list_artifacts, inspect_skills, or read_artifact unless the user asked about artifacts, files, or skills.\n"
    "5. During reasoning, assess whether the user's question requires external factual information "
    "(current events, documentation, statistics, or claims you cannot verify from context alone).\n"
    "6. When you use search_web results, cite sources inline with numbered brackets like [1], [2] "
    "matching the source index from the tool result. Do not invent citations.\n"
)


def build_system_prompt(
    web_search_mode: str = "auto", enabled_groups=None, selectable=None
) -> str:
    """The system prompt for one iteration.

    ``selectable`` (automatic tool selection only) lists the app groups that
    are *not* enabled this turn; the model is told it can add one with the
    ``request_tool_groups`` core tool if the task turns out to need it.
    """
    if web_search_mode == "forced":
        prompt = (
            SYSTEM_PROMPT_BASE
            + "7. Web search is REQUIRED for this turn. Do not provide a final answer until "
            "search_web has been run and you have incorporated the returned sources.\n"
        )
    else:
        prompt = (
            SYSTEM_PROMPT_BASE
            + "7. In auto mode, call search_web only when external factual grounding is needed; "
            "otherwise answer from existing context.\n"
        )
    if selectable:
        prompt += (
            "8. App tool groups are chosen per message. The tools listed for you are the "
            "ones selected for this message. If the task also needs one of the groups below, "
            "call request_tool_groups with its id(s) first — its tools appear on your next "
            "step — then continue. Not selected for this message:\n"
            + "".join(
                f"   - {group} ({group_label(group)}): {group_description(group)}\n"
                for group in selectable
            )
        )
    # Append the per-group tool guidance only for the groups enabled this turn.
    tools_prompt = tools_prompt_for(enabled_groups)
    if tools_prompt:
        prompt += (
            "\nApp tool guidance for the tools enabled this turn:\n\n" + tools_prompt + "\n"
        )
    return prompt


def latest_user_message(messages: List[AgentMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user" and msg.content.strip():
            return msg.content.strip()
    return ""


def has_successful_web_search(observations: List[Dict[str, Any]]) -> bool:
    return any(
        obs.get("tool") == "search_web" and obs.get("success")
        for obs in observations
    )


def search_citation_offset(observations: List[Dict[str, Any]]) -> int:
    count = 0
    for obs in observations:
        if obs.get("tool") != "search_web" or not obs.get("success"):
            continue
        sources = obs.get("result", {}).get("sources") or []
        count += len(sources)
    return count


def collect_references(observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    references: List[Dict[str, Any]] = []
    seen_urls: set[str] = set()
    index = 1
    for obs in observations:
        if obs.get("tool") != "search_web" or not obs.get("success"):
            continue
        for source in obs.get("result", {}).get("sources") or []:
            url = str(source.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            references.append({
                "index": index,
                "title": str(source.get("title") or url),
                "url": url,
            })
            index += 1
    return references


def format_search_result_text(result: Dict[str, Any]) -> str:
    lines = []
    for source in result.get("sources") or []:
        idx = source.get("index", "?")
        title = source.get("title", "Untitled")
        url = source.get("url", "")
        excerpt = str(source.get("excerpt") or source.get("snippet") or "")
        if len(excerpt) > 1200:
            excerpt = excerpt[:1200] + "... [truncated]"
        lines.append(f"[{idx}] {title}\nURL: {url}\nExcerpt: {excerpt}")
    return "\n\n".join(lines) if lines else json.dumps(result, default=str)


def format_messages_for_llm(
    messages: List[AgentMessage],
    llm_turns: Optional[List[Message]] = None,
    web_search_mode: str = "auto",
    enabled_groups=None,
    selectable=None,
) -> List[Message]:
    """Build the provider-neutral message list for one iteration.

    The chat history becomes plain ``system``/``user``/``assistant`` turns;
    everything the loop itself produced this turn — the assistant turns the
    provider returned and the tool-result turns answering them — is appended
    **verbatim** from ``llm_turns``. Nothing is re-narrated into a synthetic
    system message, which is what previously severed a tool result from the call
    that asked for it.
    """
    llm_messages: List[Message] = [
        Message.system(build_system_prompt(web_search_mode, enabled_groups, selectable))
    ]

    for msg in messages:
        role = "assistant" if msg.role == "agent" else msg.role
        content = msg.content

        # Append attachments if present to let the model know what files are uploaded/attached
        if getattr(msg, "attachments", None):
            attachment_texts = []
            for att in msg.attachments:
                name = att.get("name", "Unnamed File")
                kind = att.get("kind", "file")
                art_id = att.get("artifactId") or att.get("id")

                text_content = att.get("textContent")
                if text_content:
                    attachment_texts.append(f"[Attached file: {name}]\n```\n{text_content}\n```")
                else:
                    attachment_texts.append(f"[Attached file: {name} (Type: {kind}, ID: {art_id})]")

            if attachment_texts:
                content = content + "\n\n" + "\n\n".join(attachment_texts)

        llm_messages.append(Message(role=role, content=content))

    llm_messages.extend(llm_turns or [])
    return llm_messages


def _result_text(obs: Dict[str, Any]) -> str:
    """The text body of one tool result, without any inline media blob."""
    result = obs.get("result") or {}
    if obs.get("tool") == "search_web" and obs.get("success"):
        return format_search_result_text(result)
    if result.get("media_base64"):
        filename = (result.get("metadata") or {}).get("filename", "unknown")
        media_type = result.get("media_type", "image")
        return (
            f"{result.get('content') or f'{media_type} loaded'} "
            f"({filename}). The {media_type} follows in the next message."
        )
    body = json.dumps(result.get("content", result), default=str)
    if len(body) > MAX_RESULT_CHARS:
        body = body[:MAX_RESULT_CHARS] + "... [truncated]"
    return body


def observation_turns(obs: Dict[str, Any]) -> Tuple[Message, List[Message]]:
    """Convert one observation into a tool-result turn (+ any media turn).

    The result is keyed by ``tool_call_id`` so every provider can tie it back to
    the call: OpenAI renders it as a ``tool`` message, Anthropic as a
    ``tool_result`` block in a user turn, Gemini as a ``function_response`` part.

    Media rides in a *separate* user turn rather than inside the tool result:
    OpenAI-compatible servers reject image blocks in a ``tool`` message, and
    Anthropic requires tool_result blocks to lead the user turn they sit in.
    """
    summary = str(obs.get("summary") or "")
    tool_turn = Message(
        role="tool",
        tool_results=[
            LlmToolResult(
                tool_call_id=str(obs.get("call_id") or ""),
                content=f"{summary}\n{_result_text(obs)}".strip(),
                is_error=not obs.get("success"),
                name=obs.get("tool"),
            )
        ],
    )

    media_turns: List[Message] = []
    result = obs.get("result") or {}
    blob = result.get("media_base64")
    if blob:
        try:
            data = base64.b64decode(blob)
        except Exception:
            data = None
        if data:
            filename = (result.get("metadata") or {}).get("filename", "unknown")
            media_turns.append(
                Message(
                    role="user",
                    content=[
                        TextPart(text=f"Image returned by '{obs.get('tool')}': {filename}"),
                        ImagePart(
                            data=data,
                            mime_type=result.get("mime_type", "image/png"),
                        ),
                    ],
                )
            )
    return tool_turn, media_turns


def _thinking_blocks(raw: Any) -> Optional[List[Any]]:
    """Provider-native reasoning blocks worth replaying, if the stream gave us any.

    ``ChatResponse.as_message()`` already recovers Anthropic's; this covers the
    Gemini shape (thought parts and the thought signature riding on the first
    ``function_call`` part) for when its adapter starts attaching ``raw`` to the
    terminating chunk. Purely additive: no raw, no blocks, no harm.
    """
    if raw is None:
        return None
    try:
        candidates = getattr(raw, "candidates", None)
        if not candidates:
            return None
        parts = getattr(getattr(candidates[0], "content", None), "parts", None) or []
        blocks = [
            part
            for part in parts
            if getattr(part, "thought", False)
            or getattr(part, "thought_signature", None)
        ]
        return blocks or None
    except Exception:  # pragma: no cover - purely defensive
        return None


def _selection_mode(state: AgentState) -> str:
    """``"auto"`` or ``"manual"``. A state that never set the key is manual, so
    callers that build states by hand (tests, older clients) keep the exact
    enabled set they passed."""
    return "auto" if state.get("tool_selection") == "auto" else "manual"


def _capabilities(state: AgentState) -> set:
    return {"workspace"} if state.get("workspace_id") else set()


def select_node(state: AgentState) -> Dict[str, Any]:
    """Decide which app tool groups this turn gets (docs/tool-groups.md, D16).

    Manual mode passes the session's enabled set straight through. Automatic
    mode keeps ``core`` and the pinned groups, asks the router which other
    groups the latest message needs, and records the decision — who made it
    and why — as ``state["selection"]`` and the ``tool_groups_selected`` event.
    """
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "select"})

    given = state.get("enabled_groups")
    enabled = list(given) if given is not None else default_enabled_groups()
    pinned_state = state.get("pinned_groups")
    pinned = list(pinned_state) if pinned_state is not None else list(enabled)

    if _selection_mode(state) != "auto":
        record = {
            "groups": enabled, "pinned": pinned, "selected": [], "candidates": [],
            "dropped": [], "reason": "manual tool selection: the session's switches decide",
            "source": selection_module.SOURCE_MANUAL, "model": "",
        }
        if callback:
            callback("tool_groups_selected", record)
        return {"enabled_groups": enabled, "pinned_groups": pinned, "selection": record}

    # Core is always on in automatic mode; pinned groups ride along untouched.
    base = [CORE_GROUP] + [g for g in pinned if g != CORE_GROUP]
    candidates = selectable_groups(base, _capabilities(state))
    try:
        result = selection_module.select_tool_groups(
            state["messages"], candidates, state.get("llm_config")
        )
    except LLMProviderError as exc:
        if callback:
            callback("error", exc.to_event())
        return {"enabled_groups": base, "pinned_groups": pinned, "error": exc.message}
    except Exception as exc:
        error = f"Unexpected error in select node: {exc}"
        if callback:
            callback("error", {"message": error, "code": "internal_error"})
        return {"enabled_groups": base, "pinned_groups": pinned, "error": error}

    enabled = base + [g for g in result.selected if g not in base]
    record = result.to_record(pinned, enabled)
    if callback:
        callback("tool_groups_selected", record)
    return {"enabled_groups": enabled, "pinned_groups": pinned, "selection": record}


def reason_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "reason"})

    messages = state["messages"]
    observations = state["observations"]
    llm_turns: List[Message] = list(state.get("llm_turns") or [])
    web_search_mode = state.get("web_search_mode", "auto")
    llm_config = state.get("llm_config")
    enabled_groups = state.get("enabled_groups")

    selectable = None
    if _selection_mode(state) == "auto":
        selectable = selectable_groups(enabled_groups, _capabilities(state))
    llm_msgs = format_messages_for_llm(
        messages, llm_turns, web_search_mode, enabled_groups, selectable
    )
    tools = build_tool_schemas(enabled_groups)

    pending_actions: List[ToolCall] = []
    final_answer = None
    error = None

    try:
        if callback:
            callback("thinking_start", {})

        text_parts: List[str] = []
        thinking_parts: List[str] = []
        calls: List[LlmToolCall] = []
        done_raw: Any = None
        finish_reason = "unknown"
        model_id = ""

        for chunk in stream_chat(llm_msgs, tools=tools, config=llm_config):
            if chunk.model:
                model_id = chunk.model
            if chunk.type == "text" and chunk.text:
                text_parts.append(chunk.text)
                if callback:
                    callback("thinking_delta", {"content": chunk.text})
            elif chunk.type == "thinking" and chunk.text:
                thinking_parts.append(chunk.text)
                if callback:
                    callback("thinking_delta", {"content": chunk.text})
            elif chunk.type == "tool_call" and chunk.tool_call:
                calls.append(chunk.tool_call)
            elif chunk.type == "done":
                done_raw = chunk.raw
                finish_reason = chunk.finish_reason or "unknown"
            elif chunk.type == "error":
                raise LLMProviderError(
                    chunk.text or "The provider reported a stream error.",
                    code="stream_error",
                )

        # A server that omits call ids gets one here, on the call itself, so the
        # id we execute under is the same id the replayed assistant turn carries.
        for index, call in enumerate(calls):
            if not call.id:
                call.id = f"call_{index}"

        response = ChatResponse(
            text="".join(text_parts),
            thinking="".join(thinking_parts) or None,
            tool_calls=calls,
            finish_reason=finish_reason,
            model=model_id,
            raw=done_raw,
        )

        pending_actions = [
            ToolCall(id=call.id, name=call.name, arguments=call.arguments or {})
            for call in calls
        ]

        if not pending_actions:
            final_answer = response.text

        if (
            web_search_mode == "forced"
            and not has_successful_web_search(observations)
            and not pending_actions
        ):
            query = latest_user_message(messages)
            if query:
                call_id = f"forced_search_{state['step_count']}"
                arguments = {"query": query}
                # The injected call joins the assistant turn we are about to
                # store, so its result comes back correlated like any other.
                response.tool_calls.append(
                    LlmToolCall(id=call_id, name="search_web", arguments=arguments)
                )
                pending_actions = [
                    ToolCall(id=call_id, name="search_web", arguments=arguments)
                ]
                final_answer = None

        # The provider's own assistant item, replayed verbatim next iteration.
        assistant_turn = response.as_message()
        if assistant_turn.thinking_raw is None:
            assistant_turn.thinking_raw = _thinking_blocks(done_raw)
        llm_turns.append(assistant_turn)

    except LLMProviderError as exc:
        # No fabricated answer: the turn ends here and the frontend renders the
        # failure. A 401 must never look like a completed reply.
        error = exc.message
        if callback:
            callback("error", exc.to_event())
    except Exception as exc:
        error = f"Unexpected error in reason node: {exc}"
        if callback:
            callback("error", {"message": error, "code": "internal_error"})

    return {
        "pending_actions": pending_actions,
        "final_answer": final_answer,
        "error": error,
        "llm_turns": llm_turns,
    }


def act_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "act"})

    # Act node merely reports that tool execution is starting
    pending_actions = state.get("pending_actions", [])
    if callback:
        for action in pending_actions:
            callback("tool_call", {
                "id": action.id,
                "name": action.name,
                "arguments": action.arguments
            })

    return {}


def observe_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "observe"})

    pending_actions = state.get("pending_actions", [])
    new_observations = list(state.get("observations", []))
    llm_turns: List[Message] = list(state.get("llm_turns") or [])
    # Every tool result first, then any media turns: Anthropic requires the
    # tool_result blocks to lead the user turn that answers a tool-use turn.
    result_turns: List[Message] = []
    media_turns: List[Message] = []
    mode = _selection_mode(state)
    given = state.get("enabled_groups")
    enabled_groups: Optional[List[str]] = list(given) if given is not None else None
    groups_changed = False
    selection_record = state.get("selection")

    for action in pending_actions:
        # Create a content-based signature for dedup
        args_key = json.dumps(action.arguments, sort_keys=True, default=str)

        # Check if this exact tool+args combination was already executed. A
        # call the group gate refused never ran, so it must not block the retry
        # that follows a granted request_tool_groups.
        already_executed = any(
            obs.get("tool") == action.name
            and json.dumps(obs.get("_arguments", {}), sort_keys=True, default=str) == args_key
            and not _was_group_denied(obs)
            for obs in new_observations
        )

        if already_executed:
            # Skip duplicate — report it to the frontend but don't re-execute
            skip_item = {
                "tool": action.name,
                "call_id": action.id,
                "success": False,
                "result": {},
                "summary": f"Skipped duplicate call to '{action.name}' — already executed with same arguments this turn.",
                "artifact_ids": [],
                "_arguments": action.arguments
            }
            new_observations.append(skip_item)
            tool_turn, media = observation_turns(skip_item)
            result_turns.append(tool_turn)
            media_turns.extend(media)
            if callback:
                callback("tool_result", skip_item)
            continue

        # Inject context for inspect_chat_context tool
        if action.name == "inspect_chat_context":
            messages_raw = [m.model_dump() for m in state["messages"]]
            action.arguments["state_messages"] = messages_raw

        if action.name == "search_web":
            action.arguments["citation_offset"] = search_citation_offset(new_observations)

        tool_result: ToolResult = _execute_action(state, action, enabled_groups, mode)

        # A granted request_tool_groups widens the set for the next iteration.
        if (
            action.name == "request_tool_groups"
            and tool_result.success
            and mode == "auto"
        ):
            granted, refused = _grant_groups(
                tool_result.result.get("requested", []), enabled_groups or [], _capabilities(state)
            )
            enabled_groups = list(enabled_groups or []) + granted
            groups_changed = groups_changed or bool(granted)
            tool_result.result["granted"] = granted
            tool_result.result["refused"] = refused
            tool_result.summary = (
                f"Tool group(s) now available: {', '.join(granted)}. Their tools are listed "
                "on your next step." if granted
                else "No new tool group could be added: " + ", ".join(refused)
            )
            selection_record = {
                **(selection_record or {}),
                "groups": list(enabled_groups),
                "selected": list((selection_record or {}).get("selected", [])) + granted,
                "reason": str(action.arguments.get("reason") or "requested by the model mid-turn"),
                "source": selection_module.SOURCE_REQUEST,
            }
            if callback:
                callback("tool_groups_selected", selection_record)

        obs_item = {
            "tool": action.name,
            "call_id": action.id,
            "success": tool_result.success,
            "result": tool_result.result,
            "summary": tool_result.summary,
            "artifact_ids": tool_result.artifact_ids,
            "_arguments": action.arguments  # Store for future dedup
        }
        new_observations.append(obs_item)
        tool_turn, media = observation_turns(obs_item)
        result_turns.append(tool_turn)
        media_turns.extend(media)

        if callback:
            callback("tool_result", obs_item)

    out: Dict[str, Any] = {
        "observations": new_observations,
        "llm_turns": llm_turns + result_turns + media_turns,
        "pending_actions": [], # Clear pending actions
        "step_count": state["step_count"] + 1
    }
    if groups_changed:
        out["enabled_groups"] = enabled_groups
        out["selection"] = selection_record
    return out


def _was_group_denied(obs: Dict[str, Any]) -> bool:
    result = obs.get("result")
    return (
        isinstance(result, dict)
        and (result.get("details") or {}).get("action") == "enable_tool_group"
    )


def _execute_action(state: AgentState, action: ToolCall, enabled_groups, mode: str) -> ToolResult:
    """Run one call through the registry, with the selection-mode policy on top.

    * ``request_tool_groups`` in manual mode is refused with the standard
      ``enable_tool_group`` envelope: the user's switches stay the authority.
    * A group-gate denial in automatic mode tells the model how to add the
      group itself, instead of leaving it stuck.
    """
    if action.name == "request_tool_groups" and mode != "auto":
        wanted = action.arguments.get("groups") or []
        first = str(wanted[0]) if isinstance(wanted, list) and wanted else ""
        return ToolResult(
            success=False,
            result={
                "code": "permission_denied",
                "message": (
                    "Tool selection is manual in this chat: the user chooses the tool groups. "
                    "Ask them to enable the group instead of requesting it."
                ),
                "details": {"action": "enable_tool_group", "group": first,
                            "tool": "request_tool_groups"},
            },
            summary="request_tool_groups denied — tool selection is manual in this chat.",
            artifact_ids=[],
        )
    result = registry.execute(action.name, action.arguments, enabled_groups)
    if (
        mode == "auto"
        and not result.success
        and isinstance(result.result, dict)
        and (result.result.get("details") or {}).get("action") == "enable_tool_group"
    ):
        group = result.result["details"].get("group")
        result.summary += (
            f" Call request_tool_groups with groups=[\"{group}\"] to add it, then retry."
        )
    return result


def _grant_groups(requested, enabled: List[str], capabilities: set):
    """Split a request into groups that may be added now and those that may not."""
    granted: List[str] = []
    refused: List[str] = []
    for group in requested:
        requires = group_requires(group)
        if group in enabled:
            continue
        if requires and requires not in capabilities:
            refused.append(f"{group} (requires {requires})")
        else:
            granted.append(group)
    return granted, refused


def respond_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "respond"})

    # A failed turn already emitted an `error` event; inventing a final answer
    # on top of it is exactly the behaviour this loop was rewritten to remove.
    if state.get("error"):
        return {}

    final_answer = state.get("final_answer") or "Done."
    references = collect_references(state.get("observations", []))
    if callback:
        callback("final_answer", {"text": final_answer, "references": references})

    return {}

# Define LangGraph State Machine
workflow = StateGraph(AgentState)
workflow.add_node("select", select_node)
workflow.add_node("reason", reason_node)
workflow.add_node("act", act_node)
workflow.add_node("observe", observe_node)
workflow.add_node("respond", respond_node)

workflow.set_entry_point("select")

def route_after_select(state: AgentState):
    return "respond" if state.get("error") else "reason"

def route_after_reason(state: AgentState):
    if state.get("error"):
        return "respond"
    if state.get("pending_actions"):
        return "act"
    return "respond"

def route_after_observe(state: AgentState):
    if state.get("step_count") >= state.get("max_steps", 6):
        return "respond"
    if state.get("error"):
        return "respond"
    return "reason"

workflow.add_conditional_edges("select", route_after_select, {"reason": "reason", "respond": "respond"})
workflow.add_conditional_edges("reason", route_after_reason, {"act": "act", "respond": "respond"})
workflow.add_edge("act", "observe")
workflow.add_conditional_edges("observe", route_after_observe, {"reason": "reason", "respond": "respond"})
workflow.add_edge("respond", END)

agent_graph = workflow.compile()
