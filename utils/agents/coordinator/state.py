from typing import TypedDict, List, Dict, Any, Optional, Literal
from utils.agents.schemas.agent import ToolCall, AgentMessage
from utils.shared.llm.kit.types import Message as LlmMessage

class AgentState(TypedDict):
    messages: List[AgentMessage]
    step_count: int
    max_steps: int
    pending_actions: List[ToolCall]
    observations: List[Dict[str, Any]]
    final_answer: Optional[str]
    error: Optional[str]
    web_search_mode: Literal["auto", "forced"]
    # Enabled tool groups for this turn (see docs/tool-groups.md). Assembly and
    # execution are both gated on this set; falls back to the default set
    # (``core``) when the client omits it.
    enabled_groups: Optional[List[str]]
    # Bound workspace id, if any — a session capability that a group may require.
    workspace_id: Optional[str]
    # How the app tool groups for this turn are chosen (docs/tool-groups.md, D16).
    # ``"auto"``: the ``select`` node asks the model which groups the latest
    # message needs and adds them to ``pinned_groups``; the model can add more
    # mid-turn through the ``request_tool_groups`` core tool. ``"manual"`` (and a
    # state that never set the key): ``enabled_groups`` is used exactly as given.
    tool_selection: Optional[str]
    # Groups the user keeps always-on. Core is always included on top.
    pinned_groups: Optional[List[str]]
    # The record of this turn's selection decision — what was chosen, by whom
    # (model / keyword fallback / manual / a mid-turn request) and why. Also
    # streamed to the client as the ``tool_groups_selected`` event.
    selection: Optional[Dict[str, Any]]
    # Per-request LLM selection forwarded from the frontend settings:
    # ``{provider: slug, model: id}``, resolved server-side through
    # ``utils.shared.llm.services.registry`` so no API key crosses the wire.
    # The legacy ``{base_url, model, api_key}`` shape still resolves for an
    # un-updated client. Falls back to the default provider when absent.
    llm_config: Optional[Dict[str, Any]]
    # The provider-neutral transcript of THIS turn's loop: the assistant items
    # the provider returned, replayed verbatim, interleaved with tool-result
    # turns keyed by ``tool_call_id``. Replaying the provider's own item is what
    # keeps Anthropic thinking-block signatures and Gemini thought signatures
    # alive across a tool call — rebuilding one from strings drops them and the
    # next request 400s.
    llm_turns: List[LlmMessage]
    # For SSE streaming callback communication
    callback: Optional[Any]
