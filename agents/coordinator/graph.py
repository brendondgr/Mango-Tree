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
            "description": "Read and examine the content of an artifact file. Supports text files (code, markdown, json, etc.), image files (png, jpg, gif, webp), and video files (mp4, webm, mov). For images and videos, the file is loaded and sent to the model for visual analysis. Cannot be used for audio, PDF, or archive files.",
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

SYSTEM_PROMPT = (
    "You are Mango, a helpful assistant. Follow these rules strictly:\n"
    "1. NEVER fabricate, invent, or hallucinate information about files you have not actually read. "
    "If a tool returns 'content omitted' or 'cannot be displayed', say so honestly.\n"
    "2. When you receive image data from a tool result, describe what you actually see in the image.\n"
    "3. Do NOT call the same tool with the same arguments more than once per turn. "
    "If a tool fails or returns 'content omitted', do NOT retry it.\n"
    "4. Only call tools that are directly relevant to the user's request. "
    "Do NOT speculatively call list_artifacts, inspect_skills, or read_artifact unless the user asked about artifacts, files, or skills.\n"
)

def format_messages_for_llm(messages: List[AgentMessage], observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
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
        
    # Append observations, converting any media results into multimodal vision blocks
    if observations:
        # Build content blocks: text summaries + image_url/video entries for vision
        content_parts = []
        has_media = False
        
        for obs in observations:
            result = obs.get("result", {})
            summary_text = f"Tool '{obs.get('tool')}': {obs.get('summary')}"
            
            # Check if this observation contains media (image or video)
            if result.get("media_base64"):
                has_media = True
                media_mime = result.get("mime_type", "image/png")
                media_type = result.get("media_type", "image")
                b64 = result["media_base64"]
                filename = result.get("metadata", {}).get("filename", "unknown")
                
                # Add a text label for the media
                content_parts.append({
                    "type": "text",
                    "text": f"{summary_text}\n{media_type.title()} file: {filename}"
                })
                # Add the actual media as a vision content block
                # OpenAI-compatible APIs use image_url for both images and inline video
                content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_mime};base64,{b64}"
                    }
                })
            else:
                # Regular text observation — omit the full result dict to save tokens
                result_text = json.dumps(result.get("content", result), default=str)
                # Truncate very large results
                if len(result_text) > 4000:
                    result_text = result_text[:4000] + "... [truncated]"
                content_parts.append({
                    "type": "text",
                    "text": f"{summary_text}\nResult: {result_text}"
                })
        
        if has_media:
            # Use multimodal content format (list of content parts)
            llm_messages.append({
                "role": "user",
                "content": content_parts
            })
        else:
            # Use plain text format for non-media observations
            obs_text = "\n\n".join(
                part["text"] for part in content_parts
            )
            llm_messages.append({
                "role": "system",
                "content": f"You previously executed tools. Here are the observations:\n{obs_text}\nPlease reason on these and provide your final response or call further tools."
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
        # Create a content-based signature for dedup
        args_key = json.dumps(action.arguments, sort_keys=True, default=str)
        call_signature = f"{action.name}:{args_key}"
        
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
            if callback:
                callback("tool_result", skip_item)
            continue
        
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
            "artifact_ids": tool_result.artifact_ids,
            "_arguments": action.arguments  # Store for future dedup
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
