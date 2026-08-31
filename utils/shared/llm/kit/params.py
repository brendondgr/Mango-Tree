"""Normalized generation parameters and per-provider translation.

This is the "tweakable options" layer. An app exposes ONE set of sliders and
knobs (`GenParams`); each adapter translates them into provider-native kwargs
and reports what it had to drop.

The alternative — letting every call site pass provider-native kwargs — is how
you end up with `temperature=1.5` silently 400ing on Anthropic (whose range is
0..1, not 0..2) or being silently ignored by a DeepSeek reasoner.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field, fields
from typing import Any, Optional

from .types import ToolChoice


@dataclass
class GenParams:
    """Provider-agnostic generation settings.

    Every field is Optional and defaults to None, meaning "don't send it, use
    the provider default". This matters: sending `temperature=1.0` explicitly
    is NOT the same as omitting it on models that reject sampling params
    entirely (OpenAI reasoning models, DeepSeek in thinking mode).
    """

    # --- Core sampling -----------------------------------------------------
    temperature: Optional[float] = None      # normalized 0..1 (see note below)
    top_p: Optional[float] = None
    top_k: Optional[int] = None              # not supported by OpenAI
    max_tokens: Optional[int] = None         # output tokens
    stop: Optional[list[str]] = None
    seed: Optional[int] = None
    presence_penalty: Optional[float] = None
    frequency_penalty: Optional[float] = None

    # --- Reasoning ---------------------------------------------------------
    # One knob, three provider mechanisms:
    #   OpenAI    -> reasoning.effort / reasoning_effort  (string)
    #   Anthropic -> output_config.effort (4.7+) or thinking.budget_tokens (<=4.6)
    #   Gemini    -> thinking_level (3.x) or thinking_budget (2.5.x)
    #   local     -> chat_template_kwargs.enable_thinking / think
    reasoning_effort: Optional[str] = None   # "none"|"minimal"|"low"|"medium"|"high"|"max"
    thinking_budget: Optional[int] = None    # explicit token budget, when supported
    include_thoughts: bool = False           # surface reasoning text to the caller

    # --- Structure ---------------------------------------------------------
    json_mode: bool = False                  # "must be valid JSON", loose
    response_schema: Optional[Any] = None    # dict JSON Schema or a Pydantic model
    schema_name: str = "response"
    strict_schema: bool = True

    # --- Tools -------------------------------------------------------------
    tool_choice: Optional[ToolChoice] = None
    parallel_tool_calls: Optional[bool] = None

    # --- Caching -----------------------------------------------------------
    cache_prompt: bool = False               # request prompt caching where explicit
    cache_ttl: Optional[str] = None          # "5m" | "1h" (Anthropic), "30m" (OpenAI)
    cache_key: Optional[str] = None          # OpenAI prompt_cache_key / routing hint

    # --- Escape hatch ------------------------------------------------------
    # Merged verbatim into the provider request body. Use for genuinely
    # provider-specific knobs: vLLM's structured_outputs, llama.cpp's mirostat,
    # Ollama's num_ctx. Keyed by provider name so one GenParams can be shared:
    #   extra={"vllm": {"top_k": 40}, "ollama": {"options": {"num_ctx": 8192}}}
    extra: dict[str, dict[str, Any]] = field(default_factory=dict)

    def merged(self, **overrides: Any) -> "GenParams":
        """Return a copy with per-call overrides applied."""
        known = {f.name for f in fields(self)}
        base = {f.name: getattr(self, f.name) for f in fields(self)}
        loose: dict[str, Any] = {}
        for k, v in overrides.items():
            if k in known:
                base[k] = v
            else:
                loose[k] = v
        out = GenParams(**base)
        if loose:
            out.extra = {**out.extra, "_loose": {**out.extra.get("_loose", {}), **loose}}
        return out

    def for_provider(self, provider: str) -> dict[str, Any]:
        """Provider-specific extras, including loose per-call kwargs."""
        merged = dict(self.extra.get("_loose", {}))
        merged.update(self.extra.get(provider, {}))
        return merged


# --------------------------------------------------------------------------
# Translation helpers
# --------------------------------------------------------------------------


class Dropped(list):
    """Names of parameters an adapter could not translate.

    Adapters append to this rather than raising, because a dropped `top_k` on
    OpenAI should not break a request that is otherwise fine — but you do want
    to know it happened. `strict_params=True` on the config turns these into
    errors instead.
    """


def warn_dropped(provider: str, model: str, dropped: Dropped, strict: bool = False) -> None:
    if not dropped:
        return
    msg = (
        f"{provider}/{model or '?'}: ignoring unsupported parameter(s): "
        f"{', '.join(sorted(set(dropped)))}"
    )
    if strict:
        from .errors import InvalidRequestError

        raise InvalidRequestError(msg, provider=provider, model=model)
    warnings.warn(msg, RuntimeWarning, stacklevel=3)


def scale_temperature(t: Optional[float], max_value: float) -> Optional[float]:
    """Rescale a normalized 0..1 temperature onto a provider's native range.

    llmkit's `GenParams.temperature` is defined on 0..1 because that is the
    intersection of every provider's range. OpenAI-family servers accept 0..2,
    so a slider at 1.0 means "maximum" everywhere rather than "middling" on
    OpenAI and "maximum" on Anthropic.

    Set `native_temperature=True` on a ProviderConfig to disable this and pass
    values through untouched.
    """
    if t is None:
        return None
    t = max(0.0, min(1.0, float(t)))
    return round(t * max_value, 4)


# Effort levels, ordered. Used to snap a requested level onto what a given
# provider/model actually accepts.
EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"]


def snap_effort(requested: Optional[str], allowed: list[str]) -> Optional[str]:
    """Pick the closest supported effort level.

    Providers publish different ladders (`minimal` exists on some OpenAI
    models but not others; Anthropic uses low/medium/high/xhigh/max; Gemini 3
    uses minimal/low/medium/high). Snapping avoids a 400 when a UI offers a
    single unified list.
    """
    if requested is None or not allowed:
        return requested if requested in allowed else None
    if requested in allowed:
        return requested
    try:
        want = EFFORT_ORDER.index(requested)
    except ValueError:
        return allowed[len(allowed) // 2]
    best = min(
        allowed,
        key=lambda a: abs(EFFORT_ORDER.index(a) - want)
        if a in EFFORT_ORDER
        else 99,
    )
    return best


def schema_to_dict(schema: Any) -> dict[str, Any]:
    """Accept a dict schema or a Pydantic model; return a plain JSON Schema."""
    if schema is None:
        return {}
    if isinstance(schema, dict):
        return schema
    if hasattr(schema, "model_json_schema"):        # pydantic v2
        return schema.model_json_schema()
    if hasattr(schema, "schema"):                   # pydantic v1
        return schema.schema()
    raise TypeError(f"Cannot derive a JSON Schema from {type(schema)!r}")


def harden_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Make a JSON Schema satisfy OpenAI/Anthropic strict-mode rules.

    Strict mode requires, recursively:
      * `additionalProperties: false` on every object
      * every key in `properties` also listed in `required`

    Pydantic does not emit either by default, and the resulting 400 ("schema
    must have additionalProperties set to false") is one of the most common
    structured-output failures. This walks the tree and fixes both, including
    through `$defs`, `anyOf`, `items`, and nested properties.

    Note: this makes every field required. To model a genuinely optional field
    under strict mode, declare it as a nullable union (`{"type": ["string",
    "null"]}`) rather than omitting it from `required`.
    """
    import copy

    schema = copy.deepcopy(schema)

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" or "properties" in node:
                node.setdefault("additionalProperties", False)
                props = node.get("properties")
                if isinstance(props, dict) and props:
                    node["required"] = list(props.keys())
            for key in ("properties", "$defs", "definitions"):
                sub = node.get(key)
                if isinstance(sub, dict):
                    for v in sub.values():
                        walk(v)
            for key in ("items", "additionalItems", "contains", "not"):
                if key in node:
                    walk(node[key])
            for key in ("anyOf", "oneOf", "allOf", "prefixItems"):
                sub = node.get(key)
                if isinstance(sub, list):
                    for v in sub:
                        walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    return schema
