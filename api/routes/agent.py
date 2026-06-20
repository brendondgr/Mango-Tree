import json
import queue
import threading
from django.http import StreamingHttpResponse
from django.urls import path
from pydantic import ValidationError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.agents.coordinator.graph import agent_graph
from utils.agents.schemas.agent import AgentMessage


def _parse_web_search_mode(value) -> str:
    if value in ("auto", "forced"):
        return value
    return "auto"


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

    user_message_text = data.get("message") or ""
    history_raw = data.get("history") or []
    attachments_raw = data.get("attachments") or []

    messages = []
    try:
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
    except ValidationError as exc:
        return Response({"detail": exc.errors()}, status=400)

    initial_state = {
        "messages": messages,
        "step_count": 0,
        "max_steps": data.get("max_steps", 6),
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "web_search_mode": _parse_web_search_mode(data.get("web_search_mode", "auto")),
        "callback": None,
    }
    
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
