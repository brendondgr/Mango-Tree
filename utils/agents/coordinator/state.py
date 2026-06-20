from typing import TypedDict, List, Dict, Any, Optional, Literal
from utils.agents.schemas.agent import ToolCall, AgentMessage

class AgentState(TypedDict):
    messages: List[AgentMessage]
    step_count: int
    max_steps: int
    pending_actions: List[ToolCall]
    observations: List[Dict[str, Any]]
    final_answer: Optional[str]
    error: Optional[str]
    web_search_mode: Literal["auto", "forced"]
    # Per-request LLM overrides forwarded from the frontend settings
    # ({base_url, model, api_key}); falls back to env defaults when absent.
    llm_config: Optional[Dict[str, Any]]
    # For SSE streaming callback communication
    callback: Optional[Any]
