"""Normalized types shared by every provider adapter.

Design rule: these types are the *only* thing application code should touch.
Provider-native objects are always reachable via `.raw` when you need an escape
hatch, but nothing in an app should branch on provider name.
"""

from __future__ import annotations

import base64
import mimetypes
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Iterable, Literal, Optional, Union

# --------------------------------------------------------------------------
# Capabilities
# --------------------------------------------------------------------------


class Capability(str, Enum):
    """What a model can do.

    Populated from real discovery data where the provider exposes it
    (Ollama `/api/show`.capabilities, Anthropic `/v1/models`.capabilities,
    Gemini `Model.supported_actions`), and from ID-pattern heuristics where it
    does not (OpenAI, vLLM, llama.cpp, DeepSeek).

    Treat a capability as a *hint*, never a guarantee. `UNKNOWN` in the set
    means "we could not determine this" — the correct response is to try the
    call and handle the error, not to refuse.
    """

    CHAT = "chat"
    COMPLETION = "completion"          # raw (non-chat) completion endpoint
    TOOLS = "tools"
    VISION = "vision"
    AUDIO_IN = "audio_in"
    AUDIO_OUT = "audio_out"
    PDF = "pdf"
    THINKING = "thinking"              # reasoning / extended thinking
    STRUCTURED_OUTPUT = "structured_output"   # schema-constrained decoding
    JSON_MODE = "json_mode"            # looser "must be valid JSON"
    EMBEDDING = "embedding"
    RERANK = "rerank"
    FIM = "fim"                        # fill-in-the-middle / infill
    CACHING = "caching"
    BATCH = "batch"
    UNKNOWN = "unknown"


# --------------------------------------------------------------------------
# Model metadata
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelInfo:
    """One row in a model dropdown.

    `id` is what you pass back as `model=`. Everything else is decoration that
    may be None — never make code paths depend on a field being populated,
    because coverage differs enormously by provider (see
    references/discovery.md for the per-provider matrix).
    """

    id: str
    provider: str
    display_name: Optional[str] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None
    capabilities: frozenset[Capability] = frozenset()
    family: Optional[str] = None
    created: Optional[int] = None
    # Extra provider-specific metadata worth surfacing in a UI tooltip:
    # parameter_size, quantization, owned_by, size_bytes, loaded, ...
    meta: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    def supports(self, cap: Capability) -> bool:
        return cap in self.capabilities

    def label(self) -> str:
        """Human-readable label for a dropdown entry."""
        base = self.display_name or self.id
        bits = []
        if self.context_window:
            bits.append(_humanize_tokens(self.context_window))
        if self.meta.get("parameter_size"):
            bits.append(str(self.meta["parameter_size"]))
        if self.meta.get("quantization_level"):
            bits.append(str(self.meta["quantization_level"]))
        return f"{base} ({', '.join(bits)})" if bits else base

    def to_dict(self) -> dict[str, Any]:
        """JSON-safe form, for shipping to a frontend."""
        return {
            "id": self.id,
            "provider": self.provider,
            "display_name": self.display_name,
            "label": self.label(),
            "context_window": self.context_window,
            "max_output_tokens": self.max_output_tokens,
            "capabilities": sorted(c.value for c in self.capabilities),
            "family": self.family,
            "created": self.created,
            "meta": self.meta,
        }


def _humanize_tokens(n: int) -> str:
    """40960 -> '41K ctx'. Rounded, because a dropdown label is not a spec."""
    if n >= 1_000_000:
        return f"{round(n / 1_000_000, 1):g}M ctx"
    if n >= 1_000:
        return f"{round(n / 1_000):g}K ctx"
    return f"{n} ctx"


# --------------------------------------------------------------------------
# Content parts
# --------------------------------------------------------------------------


@dataclass
class TextPart:
    text: str
    type: Literal["text"] = "text"


@dataclass
class ImagePart:
    """An image input.

    Exactly one of `url` or `data` should be set. Providers differ sharply on
    whether a remote URL is fetched server-side (OpenAI, Anthropic, Gemini via
    Files) or rejected (Ollama's /v1 layer). `to_data()` normalizes to base64
    so an adapter can always fall back.
    """

    url: Optional[str] = None
    data: Optional[bytes] = None
    mime_type: Optional[str] = None
    detail: Optional[Literal["auto", "low", "high", "original"]] = None
    type: Literal["image"] = "image"

    @classmethod
    def from_path(cls, path: Union[str, Path], **kw: Any) -> "ImagePart":
        p = Path(path)
        mime = mimetypes.guess_type(p.name)[0] or "image/png"
        return cls(data=p.read_bytes(), mime_type=mime, **kw)

    def to_b64(self) -> str:
        if self.data is None:
            raise ValueError("ImagePart has no inline data; fetch the URL first")
        return base64.b64encode(self.data).decode()

    def to_data_uri(self) -> str:
        return f"data:{self.mime_type or 'image/png'};base64,{self.to_b64()}"


@dataclass
class FilePart:
    """A document (usually PDF)."""

    data: Optional[bytes] = None
    url: Optional[str] = None
    file_id: Optional[str] = None       # provider-side uploaded file handle
    filename: Optional[str] = None
    mime_type: str = "application/pdf"
    type: Literal["file"] = "file"

    @classmethod
    def from_path(cls, path: Union[str, Path], **kw: Any) -> "FilePart":
        p = Path(path)
        mime = mimetypes.guess_type(p.name)[0] or "application/pdf"
        return cls(data=p.read_bytes(), filename=p.name, mime_type=mime, **kw)

    def to_b64(self) -> str:
        if self.data is None:
            raise ValueError("FilePart has no inline data")
        return base64.b64encode(self.data).decode()


@dataclass
class AudioPart:
    data: Optional[bytes] = None
    url: Optional[str] = None
    format: str = "wav"
    type: Literal["audio"] = "audio"

    def to_b64(self) -> str:
        if self.data is None:
            raise ValueError("AudioPart has no inline data")
        return base64.b64encode(self.data).decode()


ContentPart = Union[TextPart, ImagePart, FilePart, AudioPart]
Content = Union[str, list[ContentPart]]


# --------------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------------


@dataclass
class ToolDef:
    """A function the model may call.

    `parameters` is a plain JSON Schema object. Adapters reshape it into each
    provider's envelope (OpenAI nests under `function`, Anthropic calls it
    `input_schema`, Gemini calls it `parameters_json_schema`).

    `strict=True` requests schema-guaranteed arguments. Support is uneven:
    OpenAI and Anthropic honor it; DeepSeek needs the /beta base URL; Gemini
    and most local servers ignore it. See references/capability-matrix.md §3.
    """

    name: str
    description: str = ""
    parameters: dict[str, Any] = field(
        default_factory=lambda: {"type": "object", "properties": {}}
    )
    strict: bool = False
    # Optional Python callable, so an agent loop can execute it directly.
    fn: Optional[Any] = None

    @classmethod
    def from_function(cls, fn: Any, strict: bool = False) -> "ToolDef":
        """Build a ToolDef from a type-hinted Python function.

        Docstring becomes the description; annotations become the schema.
        Deliberately simple — for anything beyond flat scalar args, write the
        schema by hand.
        """
        import inspect
        import typing

        hints = typing.get_type_hints(fn)
        sig = inspect.signature(fn)
        json_types = {
            str: "string", int: "integer", float: "number",
            bool: "boolean", list: "array", dict: "object",
        }
        props: dict[str, Any] = {}
        required: list[str] = []
        for pname, param in sig.parameters.items():
            if pname in ("self", "cls"):
                continue
            ann = hints.get(pname, str)
            origin = typing.get_origin(ann) or ann
            props[pname] = {"type": json_types.get(origin, "string")}
            if param.default is inspect.Parameter.empty:
                required.append(pname)
        return cls(
            name=fn.__name__,
            description=(fn.__doc__ or "").strip(),
            parameters={
                "type": "object",
                "properties": props,
                "required": required,
                "additionalProperties": False,
            },
            strict=strict,
            fn=fn,
        )


@dataclass
class ToolCall:
    """A tool invocation emitted by the model."""

    id: str
    name: str
    arguments: dict[str, Any]
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolResult:
    tool_call_id: str
    content: Union[str, list[ContentPart]]
    is_error: bool = False
    name: Optional[str] = None


ToolChoice = Union[
    Literal["auto", "none", "required", "any"],
    dict,   # {"name": "get_weather"} to force a specific tool
]


# --------------------------------------------------------------------------
# Messages
# --------------------------------------------------------------------------


Role = Literal["system", "user", "assistant", "tool"]


@dataclass
class Message:
    """One conversation turn.

    Note the deliberate use of a `system` role even though Anthropic and Gemini
    have no such role on the wire — adapters lift it into the native
    `system` / `system_instruction` parameter. See references/pitfalls.md
    ("system prompt silently ignored").
    """

    role: Role
    content: Content = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    # Opaque provider state that MUST survive round-tripping: Anthropic
    # thinking-block signatures, Gemini thought_signatures, OpenAI encrypted
    # reasoning items. Dropping these breaks multi-turn reasoning + tool use.
    thinking: Optional[str] = None
    thinking_raw: Optional[Any] = None
    name: Optional[str] = None

    @staticmethod
    def system(text: str) -> "Message":
        return Message(role="system", content=text)

    @staticmethod
    def user(content: Content) -> "Message":
        return Message(role="user", content=content)

    @staticmethod
    def assistant(content: Content = "", **kw: Any) -> "Message":
        return Message(role="assistant", content=content, **kw)

    @staticmethod
    def tool(tool_call_id: str, content: Content, is_error: bool = False) -> "Message":
        return Message(
            role="tool",
            tool_results=[ToolResult(tool_call_id, content, is_error)],
        )

    def text(self) -> str:
        if isinstance(self.content, str):
            return self.content
        return "".join(p.text for p in self.content if isinstance(p, TextPart))


def normalize_messages(messages: Iterable[Union[Message, dict]]) -> list[Message]:
    """Accept either Message objects or plain OpenAI-style dicts."""
    out: list[Message] = []
    for m in messages:
        if isinstance(m, Message):
            out.append(m)
        elif isinstance(m, dict):
            out.append(
                Message(
                    role=m.get("role", "user"),
                    content=m.get("content", ""),
                    name=m.get("name"),
                )
            )
        else:
            raise TypeError(f"Cannot interpret {type(m)!r} as a Message")
    return out


# --------------------------------------------------------------------------
# Usage and responses
# --------------------------------------------------------------------------


@dataclass
class Usage:
    """Token accounting, normalized.

    Careful: providers disagree about whether cached tokens are *included in*
    or *additional to* the input count. Anthropic reports
    `cache_read_input_tokens` separately from `input_tokens` (total input is
    the sum); OpenAI reports `cached_tokens` as a *subset* of `input_tokens`.
    `billable_input_tokens` resolves this so cost math is comparable.
    """

    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cached_read_tokens: int = 0
    cached_write_tokens: int = 0
    # True when cached_read_tokens is *in addition to* input_tokens.
    cache_is_additive: bool = False
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def billable_input_tokens(self) -> int:
        if self.cache_is_additive:
            return self.input_tokens + self.cached_read_tokens + self.cached_write_tokens
        return self.input_tokens

    @property
    def total_tokens(self) -> int:
        return self.billable_input_tokens + self.output_tokens

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            reasoning_tokens=self.reasoning_tokens + other.reasoning_tokens,
            cached_read_tokens=self.cached_read_tokens + other.cached_read_tokens,
            cached_write_tokens=self.cached_write_tokens + other.cached_write_tokens,
            cache_is_additive=self.cache_is_additive or other.cache_is_additive,
        )


FinishReason = Literal[
    "stop", "length", "tool_calls", "content_filter", "pause", "error", "unknown"
]


@dataclass
class ChatResponse:
    """A completed non-streaming response."""

    text: str = ""
    thinking: Optional[str] = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: FinishReason = "unknown"
    usage: Usage = field(default_factory=Usage)
    model: str = ""
    provider: str = ""
    parsed: Optional[Any] = None       # populated when a response_schema was used
    raw: Any = None

    def as_message(self) -> Message:
        """Turn the response into an assistant turn you can append to history."""
        return Message(
            role="assistant",
            content=self.text,
            tool_calls=self.tool_calls,
            thinking=self.thinking,
            thinking_raw=_extract_thinking_raw(self.raw),
        )

    def __str__(self) -> str:
        return self.text


def _extract_thinking_raw(raw: Any) -> Any:
    """Best-effort capture of provider-native reasoning blocks for round-tripping."""
    try:
        content = getattr(raw, "content", None)
        if isinstance(content, list):
            blocks = [
                b for b in content
                if getattr(b, "type", None) in ("thinking", "redacted_thinking")
            ]
            return blocks or None
    except Exception:  # pragma: no cover - purely defensive
        pass
    return None


ChunkType = Literal[
    "text", "thinking", "tool_call", "usage", "start", "done", "error"
]


@dataclass
class StreamChunk:
    """One event from a normalized stream.

    Every adapter emits: zero or more `text`/`thinking` chunks, zero or more
    `tool_call` chunks (already fully assembled — partial JSON accumulation is
    the adapter's job, not yours), then exactly one `done` carrying final usage.
    """

    type: ChunkType
    text: str = ""
    tool_call: Optional[ToolCall] = None
    usage: Optional[Usage] = None
    finish_reason: Optional[FinishReason] = None
    model: str = ""
    raw: Any = None

    def __str__(self) -> str:
        return self.text
