import json
import time
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
            "description": "Read the content of a specific text-based artifact file (e.g., code, markdown, txt, json, yaml). Do not use this tool for binary files like images, videos, PDFs, zip, or audio files, as they cannot be represented as text.",
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
            "description": "Read the content of a specific agent skill document. Always call inspect_skills first to get valid skill names.",
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
                
        llm_messages.append({"role": role, "content": content})
        
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
    
    try:
        if callback:
            callback("thinking_start", {})
        
        # We do a streaming tool-call check
        response_stream = chat_complete(llm_msgs, tools=TOOL_SCHEMAS, stream=True)
        
        content_accum = ""
        tool_calls_accum = {}
        
        for line in response_stream.iter_lines():
            if not line:
                continue
            line_str = line.decode("utf-8").strip()
            if not line_str.startswith("data:"):
                continue
            data_str = line_str[5:].strip()
            if data_str == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
                if not chunk.get("choices"):
                    continue
                delta = chunk["choices"][0].get("delta", {})
                
                # Stream thinking text delta
                if "content" in delta and delta["content"]:
                    content_delta = delta["content"]
                    content_accum += content_delta
                    if callback:
                        callback("thinking_delta", {"content": content_delta})
                        
                # Handle streaming tool calls
                if "tool_calls" in delta:
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_accum:
                            tool_calls_accum[idx] = {"id": "", "name": "", "arguments": ""}
                        
                        if "id" in tc and tc["id"]:
                            tool_calls_accum[idx]["id"] = tc["id"]
                        if "function" in tc:
                            fn = tc["function"]
                            if "name" in fn and fn["name"]:
                                tool_calls_accum[idx]["name"] = fn["name"]
                            if "arguments" in fn and fn["arguments"]:
                                tool_calls_accum[idx]["arguments"] += fn["arguments"]
            except Exception:
                pass
                
        # Post-process accumulated tool calls
        for idx, tc in tool_calls_accum.items():
            args = {}
            try:
                args = json.loads(tc["arguments"])
            except:
                pass
            pending_actions.append(ToolCall(
                id=tc["id"] or f"call_{idx}",
                name=tc["name"],
                arguments=args
            ))
            
        if not pending_actions:
            final_answer = content_accum
            
    except LLMProviderError as e:
        # Graceful fallback simulation
        error_msg = str(e)
        if callback:
            callback("error", {"message": f"LLM offline fallback: {error_msg}"})
        
        # Simulate check skills workflow
        if state["step_count"] == 0:
            simulated_thoughts = (
                "The model server is offline. Simulating agent state machine flow...\n"
                "Let me list all available skills to understand what capabilities exist."
            )
            # Stream simulated thoughts
            if callback:
                for word in simulated_thoughts.split(" "):
                    callback("thinking_delta", {"content": word + " "})
                    time.sleep(0.06)
            final_answer = simulated_thoughts
            pending_actions.append(ToolCall(
                id="sim_call_1",
                name="inspect_skills",
                arguments={}
            ))
        else:
            simulated_thoughts = (
                "Simulated Agent state machine workflow complete.\n\n"
                "I successfully completed the loop (`reason -> act -> observe -> respond`) locally, "
                "triggering the `inspect_skills` tool and receiving the result. "
                "Once the LLM backend is online, it will fully orchestrate these tools dynamically."
            )
            # Stream simulated thoughts
            if callback:
                for word in simulated_thoughts.split(" "):
                    callback("thinking_delta", {"content": word + " "})
                    time.sleep(0.06)
            final_answer = simulated_thoughts
            
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
