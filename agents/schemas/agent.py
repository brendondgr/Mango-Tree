from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ToolCall(BaseModel):
    id: str = Field(..., description="Unique identifier for the tool call request")
    name: str = Field(..., description="Name of the tool to be executed")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments passed to the tool")

class ToolResult(BaseModel):
    success: bool = Field(..., description="Whether the tool executed successfully")
    result: Dict[str, Any] = Field(default_factory=dict, description="Structured output of the tool execution")
    summary: str = Field(..., description="Human-readable summary of what the tool accomplished")
    artifact_ids: List[str] = Field(default_factory=list, description="IDs of any artifacts created or modified")

class AgentMessage(BaseModel):
    role: str = Field(..., description="Role of the sender (e.g. user, agent)")
    content: str = Field(..., description="Text content of the message")
    thinking: Optional[str] = Field(None, description="Optional thinking trace for agent messages")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="Attached files metadata")
