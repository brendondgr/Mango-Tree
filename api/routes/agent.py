import json
import queue
import threading
from django.http import StreamingHttpResponse
from django.urls import path
from rest_framework.decorators import api_view
from agents.coordinator.graph import agent_graph
from agents.schemas.agent import AgentMessage

@api_view(["POST"])
def run_agent_turn(request, session_id):
    """
    Triggers a turn of the agent state machine on the backend and streams
    live updates (node progress, tool calls/results, final answer) to the frontend via SSE.
    """
    data = request.data or {}
    user_message_text = data.get("message", "")
    history_raw = data.get("history", [])
    attachments_raw = data.get("attachments", [])
    
    # Reconstruct conversation messages list
    messages = []
    for msg in history_raw:
        messages.append(AgentMessage(
            role=msg.get("role", "user"),
            content=msg.get("content", ""),
            thinking=msg.get("thinking"),
            attachments=msg.get("attachments")
        ))
        
    # Append current user message
    if user_message_text or attachments_raw:
        messages.append(AgentMessage(
            role="user",
            content=user_message_text,
            attachments=attachments_raw if attachments_raw else None
        ))
        
    initial_state = {
        "messages": messages,
        "step_count": 0,
        "max_steps": data.get("max_steps", 6),
        "pending_actions": [],
        "observations": [],
        "final_answer": None,
        "error": None,
        "callback": None
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
