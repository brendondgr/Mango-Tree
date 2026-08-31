"""Ollama adapter, using the NATIVE /api surface rather than /v1.

Why not just point the openai client at :11434/v1? Because the compatibility
layer throws away exactly the things a good model picker needs:

    /api/tags   size, digest, family, parameter_size, quantization_level
    /api/show   capabilities[] and the real context length
    /api/ps     which models are currently loaded (i.e. will answer instantly)

None of that survives /v1/models, which returns a bare id. It also cannot set
`num_ctx`, cannot accept remote image URLs, and has no `think` parameter.

This adapter therefore speaks the native protocol over httpx (no extra
dependency beyond what the openai package already pulls in) and exposes the
extras as first-class methods.
"""

from __future__ import annotations

import json
from typing import Any, Iterable, Iterator, Optional, Union

from ..base import Provider
from ..config import ProviderConfig
from ..discovery import infer_family
from ..errors import (
    AuthError,
    ConnectionError_,
    InvalidRequestError,
    LLMError,
    NotFoundError,
    TimeoutError_,
    classify_status,
)
from ..params import Dropped, GenParams, schema_to_dict, warn_dropped
from ..types import (
    Capability,
    ChatResponse,
    ImagePart,
    Message,
    ModelInfo,
    StreamChunk,
    TextPart,
    ToolCall,
    ToolDef,
    Usage,
    normalize_messages,
)

#: Ollama's own capability strings -> our enum.
_CAP_MAP = {
    "completion": Capability.CHAT,
    "tools": Capability.TOOLS,
    "vision": Capability.VISION,
    "thinking": Capability.THINKING,
    "embedding": Capability.EMBEDDING,
    "insert": Capability.FIM,
    "image": Capability.CHAT,
    "audio": Capability.AUDIO_IN,
}


class OllamaProvider(Provider):
    kind = "ollama"

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._http = None

    # ------------------------------------------------------------------

    @property
    def root(self) -> str:
        url = (self.config.base_url or "http://localhost:11434").rstrip("/")
        # Tolerate someone configuring the /v1 URL out of habit.
        return url[:-3].rstrip("/") if url.endswith("/v1") else url

    @property
    def http(self):
        if self._http is None:
            import httpx

            headers = dict(self.config.extra_headers)
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            self._http = httpx.Client(
                base_url=self.root,
                headers=headers,
                timeout=httpx.Timeout(
                    self.config.timeout, connect=self.config.connect_timeout
                ),
                verify=self.config.verify_ssl,
            )
        return self._http

    def _request(self, method: str, path: str, **kw: Any) -> Any:
        import httpx

        try:
            r = self.http.request(method, path, **kw)
        except httpx.TimeoutException as exc:
            raise TimeoutError_(str(exc), provider=self.name) from exc
        except httpx.RequestError as exc:
            raise ConnectionError_(
                f"Cannot reach Ollama at {self.root} — is it running? ({exc})",
                provider=self.name,
            ) from exc
        if r.status_code >= 400:
            body = r.text[:500]
            raise classify_status(r.status_code, body)(
                body or r.reason_phrase,
                provider=self.name,
                status_code=r.status_code,
            )
        return r

    # ------------------------------------------------------------------
    # Discovery — the good stuff
    # ------------------------------------------------------------------

    def list_models(self, *, deep: bool = True) -> list[ModelInfo]:
        """List installed models.

        `deep=True` additionally calls /api/show per model to get capabilities
        and context length. That is one HTTP round trip per model — fine for a
        typical host with a handful pulled, and results are cached upstream by
        `discovery.ModelCache`. Set `deep=False` for a fast, shallow listing.
        """
        data = self._request("GET", "/api/tags").json()
        loaded = self._loaded_names()
        models = []
        for entry in data.get("models", []):
            models.append(self._model_info(entry, loaded, deep=deep))
        return models

    def _loaded_names(self) -> dict[str, dict]:
        try:
            data = self._request("GET", "/api/ps").json()
        except LLMError:
            return {}
        return {m.get("name", ""): m for m in data.get("models", [])}

    def _model_info(
        self, entry: dict, loaded: dict[str, dict], *, deep: bool
    ) -> ModelInfo:
        name = entry.get("name") or entry.get("model") or ""
        details = entry.get("details") or {}
        caps: set[Capability] = set()
        ctx = None
        source = "tags-only"

        for c in entry.get("capabilities") or []:
            if mapped := _CAP_MAP.get(c):
                caps.add(mapped)

        if deep:
            try:
                info = self.show(name)
                for c in info.get("capabilities") or []:
                    if mapped := _CAP_MAP.get(c):
                        caps.add(mapped)
                ctx = _context_from_model_info(info.get("model_info") or {})
                source = "api/show"
            except LLMError:
                pass

        if not caps:
            from ..discovery import infer_capabilities

            caps = infer_capabilities(name, self.kind)
            source = "inferred-from-id"
        if Capability.EMBEDDING not in caps:
            caps.add(Capability.STRUCTURED_OUTPUT)   # `format` works on all chat models

        live = loaded.get(name)
        return ModelInfo(
            id=name,
            provider=self.name,
            display_name=name,
            context_window=(live or {}).get("context_length") or ctx,
            capabilities=frozenset(caps),
            family=details.get("family") or infer_family(name),
            meta={
                "parameter_size": details.get("parameter_size"),
                "quantization_level": details.get("quantization_level"),
                "format": details.get("format"),
                "size_bytes": entry.get("size"),
                "digest": (entry.get("digest") or "")[:12],
                "modified_at": entry.get("modified_at"),
                "loaded": name in loaded,
                "capability_source": source,
            },
            raw=entry,
        )

    def show(self, model: str) -> dict:
        """POST /api/show — capabilities, template, parameters, model_info."""
        return self._request("POST", "/api/show", json={"model": model}).json()

    def ps(self) -> list[dict]:
        """Currently loaded models. Useful for a 'ready / cold' badge in a UI."""
        return self._request("GET", "/api/ps").json().get("models", [])

    def pull(self, model: str) -> Iterator[dict]:
        """Stream a model pull. Yields Ollama's progress dicts."""
        with self.http.stream(
            "POST", "/api/pull", json={"model": model}, timeout=None
        ) as r:
            for line in r.iter_lines():
                if line:
                    yield json.loads(line)

    def warm(self, model: str, keep_alive: str = "10m") -> None:
        """Load a model into memory without generating anything.

        A cold model can take many seconds on its first token. Call this when
        the user selects a model in a dropdown and the request will feel
        instant when they actually send something.
        """
        self._request(
            "POST",
            "/api/chat",
            json={"model": model, "messages": [], "keep_alive": keep_alive},
        )

    def unload(self, model: str) -> None:
        self._request(
            "POST", "/api/chat", json={"model": model, "messages": [], "keep_alive": 0}
        )

    def health(self) -> bool:
        try:
            self._request("GET", "/api/version")
            return True
        except LLMError:
            return False

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    def _build_messages(self, msgs: list[Message]) -> list[dict]:
        out: list[dict] = []
        for m in msgs:
            if m.role == "tool":
                for tr in m.tool_results:
                    out.append(
                        {
                            "role": "tool",
                            "content": tr.content
                            if isinstance(tr.content, str)
                            else str(tr.content),
                            **({"tool_name": tr.name} if tr.name else {}),
                        }
                    )
                continue

            entry: dict[str, Any] = {"role": m.role, "content": ""}
            images: list[str] = []
            if isinstance(m.content, str):
                entry["content"] = m.content
            else:
                texts = []
                for p in m.content:
                    if isinstance(p, TextPart):
                        texts.append(p.text)
                    elif isinstance(p, ImagePart):
                        # Native Ollama takes bare base64 in an `images` array
                        # on the message — not a content block, and NOT a URL.
                        images.append(p.to_b64())
                    else:
                        raise InvalidRequestError(
                            f"Ollama does not accept {type(p).__name__} content"
                        )
                entry["content"] = "".join(texts)
            if images:
                entry["images"] = images
            if m.thinking:
                entry["thinking"] = m.thinking
            if m.tool_calls:
                entry["tool_calls"] = [
                    {"function": {"name": tc.name, "arguments": tc.arguments}}
                    for tc in m.tool_calls
                ]
            out.append(entry)
        return out

    def _body(
        self,
        messages: Iterable[Union[Message, dict]],
        model: str,
        tools: Optional[list[ToolDef]],
        p: GenParams,
        stream: bool,
    ) -> dict:
        msgs = normalize_messages(messages)
        options: dict[str, Any] = {}
        dropped = Dropped()

        if p.temperature is not None:
            options["temperature"] = p.temperature * 2.0   # Ollama range is 0..2
        if p.top_p is not None:
            options["top_p"] = p.top_p
        if p.top_k is not None:
            options["top_k"] = p.top_k
        if p.max_tokens is not None:
            options["num_predict"] = p.max_tokens
        if p.stop:
            options["stop"] = p.stop
        if p.seed is not None:
            options["seed"] = p.seed
        if p.presence_penalty is not None:
            options["presence_penalty"] = p.presence_penalty
        if p.frequency_penalty is not None:
            options["repeat_penalty"] = 1.0 + p.frequency_penalty

        body: dict[str, Any] = {
            "model": model,
            "messages": self._build_messages(msgs),
            "stream": stream,
        }

        if p.reasoning_effort == "none":
            body["think"] = False
        elif p.reasoning_effort in ("low", "medium", "high", "max"):
            # Some models (GPT-OSS family) require the string form.
            body["think"] = p.reasoning_effort
        elif p.reasoning_effort or p.include_thoughts:
            body["think"] = True

        if p.response_schema is not None:
            body["format"] = schema_to_dict(p.response_schema)
        elif p.json_mode:
            body["format"] = "json"

        if tools:
            body["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                }
                for t in tools
            ]
        if p.tool_choice is not None and not isinstance(p.tool_choice, str):
            dropped.append("tool_choice (Ollama has no forced-tool option)")

        extra = dict(p.for_provider(self.kind)) | dict(p.for_provider(self.name))
        options.update(extra.pop("options", {}) or {})
        body.update(extra)
        if options:
            body["options"] = options

        warn_dropped(self.name, model, dropped, self.config.strict_params)
        return body

    def chat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        body = self._body(messages, model, tools, p, stream=False)
        data = self._request("POST", "/api/chat", json=body).json()
        return self._parse(data, model)

    def _parse(self, data: dict, model: str) -> ChatResponse:
        msg = data.get("message") or {}
        tool_calls = [
            ToolCall(
                id=f"call_{i}",
                name=(tc.get("function") or {}).get("name", ""),
                # Native Ollama returns arguments as an OBJECT, unlike the /v1
                # layer which stringifies them to match the OpenAI spec.
                arguments=(tc.get("function") or {}).get("arguments") or {},
            )
            for i, tc in enumerate(msg.get("tool_calls") or [])
        ]
        return ChatResponse(
            text=msg.get("content", "") or "",
            thinking=msg.get("thinking") or None,
            tool_calls=tool_calls,
            finish_reason=(
                "tool_calls" if tool_calls
                else {"stop": "stop", "length": "length", "load": "stop",
                      "unload": "stop"}.get(data.get("done_reason", ""), "stop")
            ),
            usage=Usage(
                input_tokens=data.get("prompt_eval_count", 0) or 0,
                output_tokens=data.get("eval_count", 0) or 0,
                raw={
                    "total_duration_ms": _ns_to_ms(data.get("total_duration")),
                    "load_duration_ms": _ns_to_ms(data.get("load_duration")),
                    "eval_duration_ms": _ns_to_ms(data.get("eval_duration")),
                    "tokens_per_second": _tps(data),
                },
            ),
            model=data.get("model", model),
            provider=self.name,
            raw=data,
        )

    def stream(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> Iterator[StreamChunk]:
        import httpx

        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        body = self._body(messages, model, tools, p, stream=True)

        yield StreamChunk(type="start", model=model)
        try:
            with self.http.stream(
                "POST", "/api/chat", json=body, timeout=None
            ) as r:
                if r.status_code >= 400:
                    r.read()
                    raise classify_status(r.status_code, r.text)(
                        r.text[:500], provider=self.name, status_code=r.status_code
                    )
                for line in r.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    msg = data.get("message") or {}
                    if msg.get("thinking"):
                        yield StreamChunk(
                            type="thinking", text=msg["thinking"], model=model
                        )
                    if msg.get("content"):
                        yield StreamChunk(
                            type="text", text=msg["content"], model=model
                        )
                    for i, tc in enumerate(msg.get("tool_calls") or []):
                        fn = tc.get("function") or {}
                        yield StreamChunk(
                            type="tool_call",
                            tool_call=ToolCall(
                                id=f"call_{i}",
                                name=fn.get("name", ""),
                                arguments=fn.get("arguments") or {},
                            ),
                            model=model,
                        )
                    if data.get("done"):
                        parsed = self._parse(data, model)
                        yield StreamChunk(
                            type="done",
                            usage=parsed.usage,
                            finish_reason=parsed.finish_reason,
                            model=model,
                            raw=data,
                        )
        except httpx.RequestError as exc:
            raise ConnectionError_(
                f"Cannot reach Ollama at {self.root}: {exc}", provider=self.name
            ) from exc

    def embed(
        self, texts: list[str], *, model: Optional[str] = None, **kwargs: Any
    ) -> list[list[float]]:
        model = model or self.config.meta.get("embedding_model") or self._resolve_model(None)
        data = self._request(
            "POST", "/api/embed", json={"model": model, "input": texts, **kwargs}
        ).json()
        return data.get("embeddings", [])


# --------------------------------------------------------------------------


def _context_from_model_info(model_info: dict) -> Optional[int]:
    """Pull `<arch>.context_length` out of /api/show's model_info block.

    The key is architecture-prefixed (`llama.context_length`,
    `qwen3.context_length`, ...), so it has to be looked up via
    `general.architecture` rather than hardcoded.
    """
    arch = model_info.get("general.architecture")
    if arch:
        value = model_info.get(f"{arch}.context_length")
        if isinstance(value, int):
            return value
    for key, value in model_info.items():
        if key.endswith(".context_length") and isinstance(value, int):
            return value
    return None


def _ns_to_ms(v: Any) -> Optional[float]:
    return round(v / 1e6, 1) if isinstance(v, (int, float)) else None


def _tps(data: dict) -> Optional[float]:
    count, dur = data.get("eval_count"), data.get("eval_duration")
    if count and dur:
        return round(count / (dur / 1e9), 1)
    return None
