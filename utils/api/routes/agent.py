import json
import queue
import threading
from django.db import connections
from django.http import StreamingHttpResponse
from django.urls import path
from pydantic import ValidationError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.agents.coordinator.graph import agent_graph
from utils.agents.schemas.agent import AgentMessage
from utils.agents.tools.groups import resolve_enabled_groups

_ERROR_STATUS = {"validation_error": 400, "permission_denied": 403}


def _parse_web_search_mode(value) -> str:
    if value in ("auto", "forced"):
        return value
    return "auto"


def _parse_workspace_id(value):
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _session_capabilities(workspace_id):
    """Capabilities the session can satisfy for group ``requires`` checks (D15)."""
    return {"workspace"} if workspace_id else set()


def _parse_llm_config(value):
    """
    Accept an optional per-request LLM selection forwarded from the frontend.

    The current shape is ``{"provider": slug, "model": id}``: the browser names
    a provider and the server reads its key from the registry, so no secret
    travels with a turn. The older ``{"base_url", "model", "api_key"}`` shape is
    still accepted so a client that has not been updated keeps working — see
    ``utils.agents.providers.llm._inline_provider``.

    Returns a sanitized dict with only the recognized string fields, or ``None``
    when nothing usable was provided (the agent then falls back to the
    registry's default provider).
    """
    if not isinstance(value, dict):
        return None
    cleaned = {}
    for key in ("provider", "model", "base_url", "api_key"):
        raw = value.get(key)
        if isinstance(raw, str) and raw.strip():
            cleaned[key] = raw.strip()
    return cleaned or None


def _coerce_agent_message(raw: dict) -> AgentMessage:
    content = raw.get("content")
    if content is None:
        content = ""
    return AgentMessage(
        role=str(raw.get("role") or "user"),
        content=str(content),
        thinking=raw.get("thinking"),
        attachments=raw.get("attachments"),
    )


def _build_initial_state(data: dict):
    """Build the agent's initial state from a turn payload.

    Returns ``(initial_state, error)`` where ``error`` is a ``{code, message,
    details}`` envelope (unknown group / unmet ``requires``) or ``None``. Raises
    ``pydantic.ValidationError`` if a message fails to coerce.
    """
    user_message_text = data.get("message") or ""
    history_raw = data.get("history") or []
    attachments_raw = data.get("attachments") or []

    messages = []
    for msg in history_raw:
        if not isinstance(msg, dict):
            continue
        messages.append(_coerce_agent_message(msg))
    if user_message_text or attachments_raw:
        messages.append(AgentMessage(
            role="user",
            content=str(user_message_text),
            attachments=attachments_raw if attachments_raw else None,
        ))

    workspace_id = _parse_workspace_id(data.get("workspace_id"))
    enabled_groups, group_error = resolve_enabled_groups(
        data.get("enabled_groups"), _session_capabilities(workspace_id)
    )
    if group_error is not None:
        return None, group_error

    return {
        "messages": messages,
        "step_count": 0,
        "max_steps": data.get("max_steps", 6),
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "llm_turns": [],
        "web_search_mode": _parse_web_search_mode(data.get("web_search_mode", "auto")),
        "enabled_groups": enabled_groups,
        "workspace_id": workspace_id,
        "llm_config": _parse_llm_config(data.get("llm_config")),
        "callback": None,
    }, None


@api_view(["POST"])
def run_agent_turn(request, session_id):
    """
    Triggers a turn of the agent state machine on the backend and streams
    live updates (node progress, tool calls/results, final answer) to the frontend via SSE.
    """
    try:
        data = request.data or {}
    except Exception as exc:
        return Response({"detail": f"Invalid request body: {exc}"}, status=400)

    try:
        initial_state, group_error = _build_initial_state(data)
    except ValidationError as exc:
        return Response({"detail": exc.errors()}, status=400)
    if group_error is not None:
        return Response(
            group_error, status=_ERROR_STATUS.get(group_error["code"], 400)
        )

    def event_generator():
        q = queue.Queue()
        
        def callback(event_type: str, payload: dict):
            q.put({"event": event_type, "payload": payload})
            
        initial_state["callback"] = callback
        
        def run_graph_thread():
            try:
                agent_graph.invoke(initial_state)
            except Exception as e:
                import traceback
                q.put({
                    "event": "error",
                    "payload": {
                        "message": str(e),
                        "traceback": traceback.format_exc()
                    }
                })
            finally:
                # Provider resolution reads the owner's provider table, so this
                # worker thread now opens a DB connection of its own. Django only
                # closes connections on the request thread, so close it here or
                # every turn leaks one.
                connections.close_all()
                q.put(None) # Signal end of stream
                
        thread = threading.Thread(target=run_graph_thread, daemon=True)
        thread.start()
        
        while True:
            item = q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"
            
    response = StreamingHttpResponse(event_generator(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # Disable Nginx buffering
    return response

# URL patterns for the agent routes
urlpatterns = [
    path("<str:session_id>/agent_turn/", run_agent_turn, name="run-agent-turn"),
]
