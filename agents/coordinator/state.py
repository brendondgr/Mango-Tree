from typing import TypedDict, List, Dict, Any, Optional, Literal
from agents.schemas.agent import ToolCall, AgentMessage

class AgentState(TypedDict):
    messages: List[AgentMessage]
    step_count: int
    max_steps: int
    pending_actions: List[ToolCall]
    observations: List[Dict[str, Any]]
    final_answer: Optional[str]
    error: Optional[str]
    web_search_mode: Literal["auto", "forced"]
    # For SSE streaming callback communication
    callback: Optional[Any]
