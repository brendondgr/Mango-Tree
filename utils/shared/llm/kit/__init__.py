"""llmkit — one interface for OpenAI, Claude, Gemini, and OpenAI-compatible servers.

Quick start
-----------

    from llmkit import Registry, Message

    reg = Registry.from_env()                  # or Registry.from_yaml("providers.yaml")

    reg.provider_options()                     # populate the service dropdown
    reg.model_options("ollama")                # populate the model dropdown

    resp = reg.chat("ollama", [Message.user("hi")], model="qwen3:8b")
    print(resp.text, resp.usage.total_tokens)

Streaming:

    for chunk in reg.stream("openai", msgs, model="gpt-5.6"):
        if chunk.type == "text":
            print(chunk.text, end="")

Tools:

    from llmkit import ToolDef, run_tools
    run = run_tools(reg["anthropic"], msgs, [ToolDef.from_function(get_weather)])

Design notes live in the skill's `references/` directory. The short version:
application code should only ever touch the types exported here — every
provider-specific quirk is the adapter's problem, and `.raw` is the escape
hatch when you genuinely need the native object.
"""

from __future__ import annotations

__version__ = "1.0.0"

from .agent import AgentRun, AgentStep, run_tools, stream_tools
from .base import Provider
from .config import ProviderConfig, build_config, load_configs
from .discovery import (
    DiscoveryResult,
    ModelCache,
    discover_all,
    group_by_family,
    infer_capabilities,
    safe_discover,
    sort_models,
)
from .errors import (
    AuthError,
    CapabilityError,
    ConfigError,
    ConnectionError_,
    ContentFilterError,
    ContextLengthError,
    InvalidRequestError,
    LLMError,
    NotFoundError,
    OverloadedError,
    RateLimitError,
    ServerError,
    TimeoutError_,
    ToolExecutionError,
)
from .params import GenParams, harden_schema
from .registry import Registry
from .retry import CircuitBreaker, RetryPolicy, first_working, with_retry
from .types import (
    AudioPart,
    Capability,
    ChatResponse,
    FilePart,
    ImagePart,
    Message,
    ModelInfo,
    StreamChunk,
    TextPart,
    ToolCall,
    ToolDef,
    ToolResult,
    Usage,
)

__all__ = [
    "__version__",
    # entry points
    "Registry", "Provider", "ProviderConfig", "build_config", "load_configs",
    # types
    "Message", "ModelInfo", "ChatResponse", "StreamChunk", "Usage", "Capability",
    "TextPart", "ImagePart", "FilePart", "AudioPart",
    "ToolDef", "ToolCall", "ToolResult",
    "GenParams", "harden_schema",
    # discovery
    "DiscoveryResult", "ModelCache", "safe_discover", "discover_all",
    "sort_models", "group_by_family", "infer_capabilities",
    # agent
    "run_tools", "stream_tools", "AgentRun", "AgentStep",
    # resilience
    "RetryPolicy", "CircuitBreaker", "with_retry", "first_working",
    # errors
    "LLMError", "ConfigError", "AuthError", "NotFoundError", "InvalidRequestError",
    "RateLimitError", "OverloadedError", "ServerError", "ConnectionError_",
    "TimeoutError_", "ContentFilterError", "ContextLengthError", "CapabilityError",
    "ToolExecutionError",
]
