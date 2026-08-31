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

from utils.agents.coordinator.state import AgentState
from utils.agents.providers.llm import LLMProviderError, stream_chat
from utils.agents.schemas.agent import AgentMessage, ToolCall, ToolResult
from utils.agents.tools.groups import build_tool_schemas, tools_prompt_for
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


def build_system_prompt(web_search_mode: str = "auto", enabled_groups=None) -> str:
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
        Message.system(build_system_prompt(web_search_mode, enabled_groups))
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

    llm_msgs = format_messages_for_llm(
        messages, llm_turns, web_search_mode, enabled_groups
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

    for action in pending_actions:
        # Create a content-based signature for dedup
        args_key = json.dumps(action.arguments, sort_keys=True, default=str)

        # Check if this exact tool+args combination was already executed
        already_executed = any(
            obs.get("tool") == action.name and 
            json.dumps(obs.get("_arguments", {}), sort_keys=True, default=str) == args_key
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

        tool_result: ToolResult = registry.execute(
            action.name, action.arguments, state.get("enabled_groups")
        )

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

    return {
        "observations": new_observations,
        "llm_turns": llm_turns + result_turns + media_turns,
        "pending_actions": [], # Clear pending actions
        "step_count": state["step_count"] + 1
    }


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
workflow.add_node("reason", reason_node)
workflow.add_node("act", act_node)
workflow.add_node("observe", observe_node)
workflow.add_node("respond", respond_node)

workflow.set_entry_point("reason")

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

workflow.add_conditional_edges("reason", route_after_reason, {"act": "act", "respond": "respond"})
workflow.add_edge("act", "observe")
workflow.add_conditional_edges("observe", route_after_observe, {"reason": "reason", "respond": "respond"})
workflow.add_edge("respond", END)

agent_graph = workflow.compile()
