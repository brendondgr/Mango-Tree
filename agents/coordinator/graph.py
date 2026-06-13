import json
from typing import List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from agents.coordinator.state import AgentState
from agents.schemas.agent import ToolCall, ToolResult, AgentMessage
from agents.tools.registry import registry
from agents.providers.llm import chat_complete, LLMProviderError

# Declare tool specifications for OpenAI function calling format
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_artifacts",
            "description": "List all files in the artifacts directory.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_artifact",
            "description": "Read the content of a specific artifact file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "artifact_id": {
                        "type": "string",
                        "description": "The unique ID or filename of the artifact."
                    }
                },
                "required": ["artifact_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_skills",
            "description": "List all agent skills documents available in the system.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_skill",
            "description": "Read the content of a specific agent skill document.",
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "description": "The name of the skill (e.g., 'artifacts')."
                    }
                },
                "required": ["skill_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_chat_context",
            "description": "Inspect the conversation history and context.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

def format_messages_for_llm(messages: List[AgentMessage], observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    llm_messages = []
    for msg in messages:
        role = "assistant" if msg.role == "agent" else msg.role
        llm_messages.append({"role": role, "content": msg.content})
        
    # Append observations to help the model reason in context
    if observations:
        obs_summary = "\n".join([
            f"Observation from tool '{obs.get('tool')}': {obs.get('summary')}\nResult: {json.dumps(obs.get('result'))}"
            for obs in observations
        ])
        llm_messages.append({
            "role": "system",
            "content": f"You previously executed tools. Here are the observations:\n{obs_summary}\nPlease reason on these and provide your final response or call further tools."
        })
    return llm_messages

def reason_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "reason"})
        
    messages = state["messages"]
    observations = state["observations"]
    
    llm_msgs = format_messages_for_llm(messages, observations)
    
    pending_actions = []
    final_answer = None
    error = None
    
    # Try calling LLM, fallback to simulation if server is offline
    try:
        if callback:
            callback("thinking_start", {})
        
        # We do a non-streaming tool-call check
        response = chat_complete(llm_msgs, tools=TOOL_SCHEMAS)
        
        choice = response["choices"][0]["message"]
        content = choice.get("content") or ""
        tool_calls_raw = choice.get("tool_calls") or []
        
        if callback and content:
            callback("thinking_delta", {"content": content})
            
        if tool_calls_raw:
            for tc in tool_calls_raw:
                func = tc.get("function", {})
                args = {}
                try:
                    args = json.loads(func.get("arguments", "{}"))
                except:
                    pass
                pending_actions.append(ToolCall(
                    id=tc.get("id", "call_unknown"),
                    name=func.get("name"),
                    arguments=args
                ))
        else:
            final_answer = content
            
    except LLMProviderError as e:
        # Graceful fallback simulation
        error_msg = str(e)
        if callback:
            callback("error", {"message": f"LLM offline fallback: {error_msg}"})
        
        # Simulate check skills workflow
        if state["step_count"] == 0:
            final_answer = f"The model server is offline. Simulating agent state machine flow...\nLet me check the skills directory."
            pending_actions.append(ToolCall(
                id="sim_call_1",
                name="inspect_skills",
                arguments={}
            ))
        else:
            final_answer = (
                "Simulated Agent state machine workflow complete.\n\n"
                "I was able to run the loop (`reason -> act -> observe -> respond`) locally, "
                "triggering the `inspect_skills` tool and receiving the result. "
                "Once the LLM backend is online, it will fully orchestrate these tools dynamically."
            )
            
    except Exception as e:
        error = f"Unexpected error in reason node: {str(e)}"
        final_answer = f"An error occurred: {error}"
        
    return {
        "pending_actions": pending_actions,
        "final_answer": final_answer,
        "error": error
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
    
    for action in pending_actions:
        # Inject context for inspect_chat_context tool
        if action.name == "inspect_chat_context":
            messages_raw = [m.model_dump() for m in state["messages"]]
            action.arguments["state_messages"] = messages_raw
            
        tool_result: ToolResult = registry.execute(action.name, action.arguments)
        
        obs_item = {
            "tool": action.name,
            "call_id": action.id,
            "success": tool_result.success,
            "result": tool_result.result,
            "summary": tool_result.summary,
            "artifact_ids": tool_result.artifact_ids
        }
        new_observations.append(obs_item)
        
        if callback:
            callback("tool_result", obs_item)
            
    return {
        "observations": new_observations,
        "pending_actions": [], # Clear pending actions
        "step_count": state["step_count"] + 1
    }

def respond_node(state: AgentState) -> Dict[str, Any]:
    callback = state.get("callback")
    if callback:
        callback("node_start", {"node": "respond"})
        
    final_answer = state.get("final_answer") or "Done."
    if callback:
        callback("final_answer", {"text": final_answer})
        
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
