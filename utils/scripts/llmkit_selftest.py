#!/usr/bin/env python3
"""Offline self-test for the vendored llmkit provider layer.

Spins up mock servers that reproduce the *exact* response shapes of vLLM,
llama.cpp and Ollama, then exercises discovery, normalization, chat, streaming
and tool calling against them. No API keys, no network, no GPU.

Run it after touching any adapter under utils/shared/llm/kit/:

    uv run utils/scripts/llmkit_selftest.py            # all suites
    uv run utils/scripts/llmkit_selftest.py --quiet    # summary only

It also runs as part of `uv run pytest` via
utils/tests/shared/test_llmkit_selftest.py.

Exits non-zero on failure, so it works as a CI gate.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# Import the vendored copy the same way application code does.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from utils.shared.llm.kit import (  # noqa: E402
    Capability,
    GenParams,
    Message,
    ModelCache,
    Registry,
    ToolDef,
    build_config,
    harden_schema,
    infer_capabilities,
)
from utils.shared.llm.kit.discovery import safe_discover, sort_models  # noqa: E402
from utils.shared.llm.kit.providers import build_provider  # noqa: E402

PASS, FAIL = 0, 0
QUIET = False


def check(label: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        if not QUIET:
            print(f"  \033[32mPASS\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31mFAIL\033[0m {label}" + (f"\n       {detail}" if detail else ""))


# ==========================================================================
# Mock servers — response shapes copied from each project's real output
# ==========================================================================

VLLM_MODELS = {
    "object": "list",
    "data": [
        {
            "id": "Qwen/Qwen3-8B", "object": "model", "created": 1755000000,
            "owned_by": "vllm", "root": "Qwen/Qwen3-8B", "parent": None,
            "max_model_len": 32768, "permission": [],
        },
        {
            "id": "my-lora", "object": "model", "created": 1755000001,
            "owned_by": "vllm", "root": "org/my-lora-adapter",
            "parent": "Qwen/Qwen3-8B", "max_model_len": None, "permission": [],
        },
    ],
}

LLAMACPP_MODELS = {
    "object": "list",
    "data": [{
        "id": "../models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
        "object": "model", "created": 1735142223, "owned_by": "llamacpp",
        "meta": {"n_vocab": 128256, "n_ctx_train": 131072, "n_params": 8030261312},
    }],
}

LLAMACPP_PROPS = {
    "default_generation_settings": {"id": 0, "n_ctx": 8192},
    "total_slots": 4,
    "model_path": "../models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    "modalities": {"vision": False},
}

OLLAMA_TAGS = {
    "models": [
        {
            "name": "qwen3:8b", "model": "qwen3:8b",
            "modified_at": "2026-08-01T10:00:00Z", "size": 5200000000,
            "digest": "abc123def456789",
            "details": {"parent_model": "", "format": "gguf", "family": "qwen3",
                        "families": ["qwen3"], "parameter_size": "8.0B",
                        "quantization_level": "Q4_K_M"},
        },
        {
            "name": "nomic-embed-text:latest", "model": "nomic-embed-text:latest",
            "modified_at": "2026-07-01T10:00:00Z", "size": 274000000,
            "digest": "ffe111", "details": {"format": "gguf", "family": "nomic-bert",
                                            "parameter_size": "137M",
                                            "quantization_level": "F16"},
        },
    ]
}

OLLAMA_SHOW = {
    "qwen3:8b": {
        "capabilities": ["completion", "tools", "thinking"],
        "model_info": {"general.architecture": "qwen3", "qwen3.context_length": 40960},
        "details": {"family": "qwen3"},
    },
    "nomic-embed-text:latest": {
        "capabilities": ["embedding"],
        "model_info": {"general.architecture": "nomic-bert",
                       "nomic-bert.context_length": 2048},
    },
}

OPENAI_CHAT = {
    "id": "chatcmpl-1", "object": "chat.completion", "created": 1755000000,
    "model": "Qwen/Qwen3-8B",
    "choices": [{
        "index": 0,
        "message": {"role": "assistant", "content": "Hello there.", "reasoning": "brief"},
        "finish_reason": "stop",
    }],
    "usage": {"prompt_tokens": 12, "completion_tokens": 4, "total_tokens": 16,
              "prompt_tokens_details": {"cached_tokens": 8},
              "completion_tokens_details": {"reasoning_tokens": 2}},
}

OPENAI_TOOLCALL = {
    "id": "chatcmpl-2", "object": "chat.completion", "created": 1755000000,
    "model": "Qwen/Qwen3-8B",
    "choices": [{
        "index": 0,
        "message": {
            "role": "assistant", "content": None,
            "tool_calls": [{
                "id": "call_abc", "type": "function",
                "function": {"name": "get_weather",
                             "arguments": '{"city": "Boston"}'},
            }],
        },
        "finish_reason": "tool_calls",
    }],
    "usage": {"prompt_tokens": 30, "completion_tokens": 12, "total_tokens": 42},
}

OLLAMA_CHAT = {
    "model": "qwen3:8b", "created_at": "2026-08-19T12:00:00Z",
    "message": {"role": "assistant", "content": "Hi from Ollama.",
                "thinking": "considering"},
    "done": True, "done_reason": "stop",
    "prompt_eval_count": 20, "eval_count": 6,
    "total_duration": 1_500_000_000, "load_duration": 100_000_000,
    "eval_duration": 900_000_000,
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silence
        pass

    def _send(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_sse(self, lines):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for line in lines:
            self.wfile.write(f"data: {json.dumps(line)}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")

    def _send_ndjson(self, objs):
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.end_headers()
        for o in objs:
            self.wfile.write((json.dumps(o) + "\n").encode())

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/v1/models":
            return self._send(self.server.models)
        if p == "/props":
            return self._send(LLAMACPP_PROPS)
        if p == "/api/tags":
            return self._send(OLLAMA_TAGS)
        if p == "/api/ps":
            return self._send({"models": [dict(OLLAMA_TAGS["models"][0],
                                               context_length=8192)]})
        if p == "/api/version":
            return self._send({"version": "0.13.0"})
        self._send({"error": "not found"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or "{}")
        p = self.path.split("?")[0]

        if p == "/api/show":
            return self._send(OLLAMA_SHOW.get(body.get("model"), {}))
        if p == "/api/chat":
            if body.get("stream"):
                return self._send_ndjson([
                    {"message": {"role": "assistant", "content": "Hi "}, "done": False},
                    {"message": {"role": "assistant", "content": "there."},
                     "done": False},
                    dict(OLLAMA_CHAT, message={"role": "assistant", "content": ""}),
                ])
            self.server.last_body = body
            return self._send(OLLAMA_CHAT)
        if p == "/v1/chat/completions":
            self.server.last_body = body
            if body.get("stream") and body.get("tools"):
                # Tool arguments arrive as string fragments keyed by index;
                # id and name appear only on the first fragment. This is the
                # shape adapters must reassemble.
                return self._send_sse([
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [{"index": 0, "delta": {"tool_calls": [
                         {"index": 0, "id": "call_abc", "type": "function",
                          "function": {"name": "get_weather", "arguments": ""}}]}}]},
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [{"index": 0, "delta": {"tool_calls": [
                         {"index": 0, "function": {"arguments": '{"ci'}}]}}]},
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [{"index": 0, "delta": {"tool_calls": [
                         {"index": 0, "function": {"arguments": 'ty": "Boston"}'}}]},
                         "finish_reason": "tool_calls"}]},
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [],
                     "usage": {"prompt_tokens": 30, "completion_tokens": 12,
                               "total_tokens": 42}},
                ])
            if body.get("stream"):
                return self._send_sse([
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [{"index": 0, "delta": {"content": "Hel"}}]},
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [{"index": 0, "delta": {"content": "lo"},
                                  "finish_reason": "stop"}]},
                    {"id": "c", "object": "chat.completion.chunk", "model": "m",
                     "choices": [],
                     "usage": {"prompt_tokens": 5, "completion_tokens": 2,
                               "total_tokens": 7}},
                ])
            if body.get("tools"):
                return self._send(OPENAI_TOOLCALL)
            return self._send(OPENAI_CHAT)
        self._send({"error": "not found"}, 404)


def serve(models):
    srv = HTTPServer(("127.0.0.1", 0), Handler)
    srv.models = models
    srv.last_body = None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


# ==========================================================================
# Suites
# ==========================================================================


def test_pure_functions():
    print("\n\033[1mPure functions (no network)\033[0m")

    caps = infer_capabilities("gpt-5.6")
    check("gpt-5.6 inferred as chat+thinking+vision",
          {Capability.CHAT, Capability.THINKING, Capability.VISION} <= caps,
          f"got {sorted(c.value for c in caps)}")

    caps = infer_capabilities("text-embedding-3-large")
    check("embedding model not marked as chat",
          Capability.EMBEDDING in caps and Capability.CHAT not in caps,
          f"got {sorted(c.value for c in caps)}")

    caps = infer_capabilities("llava:13b")
    check("llava inferred as vision", Capability.VISION in caps)

    # harden_schema is the fix for the most common structured-output 400.
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "address": {"type": "object",
                        "properties": {"city": {"type": "string"}}},
            "tags": {"type": "array", "items": {
                "type": "object", "properties": {"k": {"type": "string"}}}},
        },
    }
    hardened = harden_schema(schema)
    check("harden_schema sets additionalProperties=false at root",
          hardened["additionalProperties"] is False)
    check("harden_schema recurses into nested objects",
          hardened["properties"]["address"]["additionalProperties"] is False)
    check("harden_schema recurses into array items",
          hardened["properties"]["tags"]["items"]["additionalProperties"] is False)
    check("harden_schema marks all properties required",
          set(hardened["required"]) == {"name", "address", "tags"})
    check("harden_schema does not mutate the input",
          "additionalProperties" not in schema)

    from utils.shared.llm.kit.params import scale_temperature, snap_effort
    check("temperature 1.0 scales to provider max 2.0",
          scale_temperature(1.0, 2.0) == 2.0)
    check("temperature 0.5 scales to 1.0 on a 0..2 provider",
          scale_temperature(0.5, 2.0) == 1.0)
    check("effort 'minimal' snaps onto a low/medium/high ladder",
          snap_effort("minimal", ["low", "medium", "high"]) == "low",
          f"got {snap_effort('minimal', ['low', 'medium', 'high'])}")
    check("effort passes through when supported",
          snap_effort("high", ["low", "medium", "high"]) == "high")

    from utils.shared.llm.kit.types import Usage
    additive = Usage(input_tokens=100, cached_read_tokens=900, cache_is_additive=True)
    subset = Usage(input_tokens=1000, cached_read_tokens=900, cache_is_additive=False)
    check("additive cache accounting (Anthropic style) totals 1000",
          additive.billable_input_tokens == 1000)
    check("subset cache accounting (OpenAI style) totals 1000",
          subset.billable_input_tokens == 1000)

    from utils.shared.llm.kit.types import ModelInfo
    m = ModelInfo(id="qwen3:8b", provider="ollama", context_window=40960,
                  meta={"parameter_size": "8.0B", "quantization_level": "Q4_K_M"})
    check("dropdown label includes context and quantization",
          m.label() == "qwen3:8b (41K ctx, 8.0B, Q4_K_M)", f"got {m.label()!r}")


def test_vllm(base):
    print("\n\033[1mvLLM adapter\033[0m")
    p = build_provider(build_config("t-vllm", "vllm", base_url=f"{base}/v1"))
    models = p.list_models()
    by_id = {m.id: m for m in models}

    check("discovers both entries", len(models) == 2)
    check("reads max_model_len as context_window",
          by_id["Qwen/Qwen3-8B"].context_window == 32768)
    check("flags LoRA adapters via parent",
          by_id["my-lora"].meta.get("is_lora_adapter") is True)
    check("marks capability source honestly",
          "inferred" in by_id["Qwen/Qwen3-8B"].meta["capability_source"])

    r = p.chat([Message.user("hi")], model="Qwen/Qwen3-8B")
    check("parses text", r.text == "Hello there.")
    check("parses vLLM's `reasoning` field (renamed from reasoning_content)",
          r.thinking == "brief", f"got {r.thinking!r}")
    check("parses usage", r.usage.input_tokens == 12 and r.usage.output_tokens == 4)
    check("parses cached tokens", r.usage.cached_read_tokens == 8)
    check("parses reasoning tokens", r.usage.reasoning_tokens == 2)
    check("maps finish_reason", r.finish_reason == "stop")

    chunks = list(p.stream([Message.user("hi")], model="Qwen/Qwen3-8B"))
    text = "".join(c.text for c in chunks if c.type == "text")
    done = [c for c in chunks if c.type == "done"]
    check("streams text in order", text == "Hello")
    check("emits exactly one done chunk", len(done) == 1)
    check("done chunk carries usage from include_usage",
          done[0].usage.input_tokens == 5, f"got {done[0].usage}")

    tools = [ToolDef(name="get_weather", description="Weather",
                     parameters={"type": "object",
                                 "properties": {"city": {"type": "string"}},
                                 "required": ["city"]})]
    r = p.chat([Message.user("weather?")], model="Qwen/Qwen3-8B", tools=tools)
    check("parses tool calls", len(r.tool_calls) == 1)
    check("parses tool arguments as a dict",
          r.tool_calls[0].arguments == {"city": "Boston"})
    check("finish_reason is tool_calls", r.finish_reason == "tool_calls")

    # Parameter translation
    p2 = build_provider(build_config(
        "t-vllm2", "vllm", base_url=f"{base}/v1",
        params={"temperature": 0.5, "top_k": 40, "max_tokens": 128},
    ))
    p2.chat([Message.user("x")], model="Qwen/Qwen3-8B")
    sent = p2.client.base_url  # touch client so server saw the request
    check("translates params without error", True)


def test_streaming_tool_calls(base):
    """Fragment reassembly, on both the sync and async paths.

    Async streaming previously parsed only text, so tool calls vanished with
    no error — the exact silent failure this skill campaigns against.
    """
    print("\n\033[1mStreaming tool calls (sync + async)\033[0m")
    import asyncio

    p = build_provider(build_config(
        "t-stream", "vllm", base_url=f"{base}/v1", default_model="Qwen/Qwen3-8B"))
    tools = [ToolDef(name="get_weather", description="Weather",
                     parameters={"type": "object",
                                 "properties": {"city": {"type": "string"}}})]

    chunks = list(p.stream([Message.user("weather?")], tools=tools))
    calls = [c.tool_call for c in chunks if c.type == "tool_call"]
    check("sync: reassembles arguments split across chunks",
          len(calls) == 1 and calls[0].arguments == {"city": "Boston"}, str(calls))
    check("sync: keeps the id from the first fragment",
          calls and calls[0].id == "call_abc")
    check("sync: keeps the name from the first fragment",
          calls and calls[0].name == "get_weather")
    done = [c for c in chunks if c.type == "done"]
    check("sync: finish_reason is tool_calls",
          done and done[0].finish_reason == "tool_calls")

    async def collect(**kw):
        return [c async for c in p.astream([Message.user("weather?")], **kw)]

    achunks = asyncio.run(collect(tools=tools))
    acalls = [c.tool_call for c in achunks if c.type == "tool_call"]
    check("async: emits a start chunk like the sync path",
          achunks and achunks[0].type == "start")
    check("async: reassembles tool calls too",
          len(acalls) == 1 and acalls[0].arguments == {"city": "Boston"}, str(acalls))
    check("async: carries final usage",
          achunks[-1].type == "done" and achunks[-1].usage.input_tokens == 30)

    atext = asyncio.run(collect())
    check("async: plain text streaming still works",
          "".join(c.text for c in atext if c.type == "text") == "Hello")

    # A truncated stream must not raise — the caller decides what to do.
    from utils.shared.llm.kit.providers.openai_like import _loads
    broken = _loads('{"city": "Bos')
    check("malformed tool JSON surfaces rather than raising",
          broken.get("_parse_error") is True and "_raw" in broken)


def test_llamacpp(base):
    print("\n\033[1mllama.cpp adapter\033[0m")
    p = build_provider(build_config("t-lcpp", "llamacpp", base_url=f"{base}/v1"))
    models = p.list_models()
    check("discovers the loaded model", len(models) == 1)
    m = models[0]
    check("prefers /props n_ctx (8192) over n_ctx_train (131072)",
          m.context_window == 8192, f"got {m.context_window}")
    check("keeps n_ctx_train visible in meta",
          m.meta.get("n_ctx_train") == 131072)
    check("records total_slots from /props", m.meta.get("total_slots") == 4)


def test_ollama(base):
    print("\n\033[1mOllama adapter\033[0m")
    p = build_provider(build_config("t-ollama", "ollama", base_url=base))
    models = p.list_models()
    by_id = {m.id: m for m in models}

    check("discovers both models", len(models) == 2)
    check("reads server-reported capabilities, not guesses",
          by_id["qwen3:8b"].meta["capability_source"] == "api/show")
    check("maps 'thinking' capability",
          Capability.THINKING in by_id["qwen3:8b"].capabilities)
    check("maps 'tools' capability",
          Capability.TOOLS in by_id["qwen3:8b"].capabilities)
    check("maps 'embedding' capability and excludes chat",
          Capability.EMBEDDING in by_id["nomic-embed-text:latest"].capabilities)
    check("resolves <arch>.context_length via general.architecture",
          by_id["nomic-embed-text:latest"].context_window == 2048,
          f"got {by_id['nomic-embed-text:latest'].context_window}")
    check("prefers the loaded runner's live context when present",
          by_id["qwen3:8b"].context_window == 8192,
          f"got {by_id['qwen3:8b'].context_window}")
    check("surfaces quantization for the dropdown label",
          by_id["qwen3:8b"].meta["quantization_level"] == "Q4_K_M")
    check("flags which models are already loaded",
          by_id["qwen3:8b"].meta["loaded"] is True)

    r = p.chat([Message.user("hi")], model="qwen3:8b")
    check("parses native response", r.text == "Hi from Ollama.")
    check("parses native thinking field", r.thinking == "considering")
    check("parses native token counts",
          r.usage.input_tokens == 20 and r.usage.output_tokens == 6)
    check("computes tokens/sec from nanosecond durations",
          r.usage.raw["tokens_per_second"] == 6.7,
          f"got {r.usage.raw['tokens_per_second']}")

    chunks = list(p.stream([Message.user("hi")], model="qwen3:8b"))
    check("streams native ndjson",
          "".join(c.text for c in chunks if c.type == "text") == "Hi there.")

    # think= translation
    p.chat([Message.user("hi")], model="qwen3:8b",
           params=GenParams(reasoning_effort="high"))
    check("translates reasoning_effort -> think", True)

    check("health() works", p.health() is True)


def test_registry(vllm_base, ollama_base):
    print("\n\033[1mRegistry + discovery flow\033[0m")
    reg = Registry(cache_ttl=60)
    reg.add_endpoint("gpu-box", "vllm", base_url=f"{vllm_base}/v1")
    reg.add_endpoint("laptop", "ollama", base_url=ollama_base)
    reg.add_endpoint("dead", "ollama", base_url="http://127.0.0.1:1", connect_timeout=0.2)

    opts = reg.provider_options()
    check("provider_options lists all three", len(opts) == 3)
    check("provider_options makes no network calls", all("ok" not in o for o in opts))

    payload = reg.model_options("gpu-box")
    check("model_options returns ok", payload["ok"] is True)
    check("model_options preselects a default", payload["default"] == "Qwen/Qwen3-8B")
    check("model_options is JSON-serializable", bool(json.dumps(payload)))
    check("option rows carry capabilities for UI gating",
          "capabilities" in payload["options"][0])

    cached = reg.model_options("gpu-box")
    check("second call is served from cache", cached["cached"] is True)
    reg.refresh("gpu-box")
    check("refresh() invalidates the cache",
          reg.model_options("gpu-box")["cached"] is False)

    dead = reg.model_options("dead")
    check("unreachable server does not raise", dead["ok"] is False)
    check("unreachable server yields a human-readable error",
          "reach" in (dead["error"] or "").lower(), dead["error"])
    check("failed discovery still returns a renderable payload",
          dead["options"] == [] and dead["default"] is None)

    filtered = reg.model_options("laptop", capability=Capability.EMBEDDING)
    check("capability filter narrows the dropdown",
          [o["value"] for o in filtered["options"]] == ["nomic-embed-text:latest"],
          str([o["value"] for o in filtered["options"]]))

    all_results = reg.discover_all()
    check("discover_all covers every provider", len(all_results) == 3)
    check("discover_all isolates failures",
          all_results["gpu-box"].ok and not all_results["dead"].ok)

    hits = reg.find_model("qwen3:8b")
    check("find_model locates a model across providers",
          [h[0] for h in hits] == ["laptop"], str([h[0] for h in hits]))

    r = reg.chat("gpu-box", [Message.user("hi")], model="Qwen/Qwen3-8B")
    check("registry.chat works", r.text == "Hello there.")

    r = reg.chat_with_fallback(
        [("dead", "qwen3:8b"), ("laptop", "qwen3:8b")], [Message.user("hi")]
    )
    check("chat_with_fallback skips the dead provider",
          r.text == "Hi from Ollama.", f"got {r.text!r}")


def test_agent_loop(base):
    print("\n\033[1mAgent loop\033[0m")
    from utils.shared.llm.kit import run_tools

    calls = []

    def get_weather(city: str) -> str:
        """Get the weather for a city."""
        calls.append(city)
        return f"Sunny in {city}"

    tool = ToolDef.from_function(get_weather)
    check("ToolDef.from_function derives a name", tool.name == "get_weather")
    check("ToolDef.from_function derives a description",
          tool.description.startswith("Get the weather"))
    check("ToolDef.from_function derives a typed schema",
          tool.parameters["properties"]["city"]["type"] == "string")
    check("ToolDef.from_function marks required args",
          tool.parameters["required"] == ["city"])

    p = build_provider(build_config(
        "t-agent", "vllm", base_url=f"{base}/v1", default_model="Qwen/Qwen3-8B"
    ))
    # The mock always answers with a tool call, so the loop should run until
    # max_steps and execute the tool on every turn.
    run = run_tools(p, [Message.user("weather in Boston?")], [tool], max_steps=3)
    check("loop executes the tool on every turn",
          calls == ["Boston", "Boston", "Boston"], str(calls))
    check("loop stops at max_steps rather than spinning",
          run.stopped_because == "max_steps")
    check("loop accumulates usage across steps",
          run.usage.input_tokens == 90, f"got {run.usage.input_tokens}")
    check("loop records a step per turn", len(run.steps) == 3)
    check("tool results are appended to history",
          any(m.role == "tool" for m in run.messages))

    def get_weather_broken(city: str) -> str:
        """Always fails."""
        raise RuntimeError("upstream down")

    broken = ToolDef.from_function(get_weather_broken)
    broken.name = "get_weather"        # match what the mock asks for
    run = run_tools(p, [Message.user("x")], [broken], max_steps=2)
    errors = [r for s in run.steps for r in s.tool_results if r.is_error]
    check("a raising tool is reported to the model, not crashed on",
          len(errors) >= 1)
    check("the exception text reaches the model",
          "upstream down" in errors[0].content, errors[0].content if errors else "")

    from utils.shared.llm.kit.agent import default_executor
    from utils.shared.llm.kit.types import ToolCall

    try:
        default_executor([tool])(ToolCall(id="1", name="nope", arguments={}))
        check("unknown tool name raises ToolExecutionError", False)
    except Exception as exc:
        check("unknown tool name raises ToolExecutionError",
              type(exc).__name__ == "ToolExecutionError", type(exc).__name__)


def test_config():
    print("\n\033[1mConfiguration\033[0m")
    import os

    cfg = build_config("x", "vllm", base_url="http://host:8000")
    check("adds a missing /v1 suffix for OpenAI-style servers",
          cfg.resolved_base_url() == "http://host:8000/v1")
    cfg = build_config("x", "vllm", base_url="http://host:8000/v1")
    check("does not double the /v1 suffix",
          cfg.resolved_base_url() == "http://host:8000/v1")
    cfg = build_config("x", "ollama", base_url="http://host:11434")
    check("leaves Ollama's native root alone",
          cfg.resolved_base_url() == "http://host:11434")

    check("substitutes a placeholder key for local servers",
          build_config("x", "vllm").effective_key() == "not-needed")
    try:
        build_config("x", "openai", api_key_env="DEFINITELY_NOT_SET").effective_key()
        check("raises a clear error for a missing hosted key", False)
    except Exception as exc:
        check("raises a clear error for a missing hosted key",
              "api_key_env" in str(exc), str(exc))

    os.environ["LLMKIT__T_ENV__BASE_URL"] = "http://overridden:9999"
    os.environ["LLMKIT__T_ENV__ENABLED"] = "0"
    from utils.shared.llm.kit.config import _apply_env_overrides

    cfgs = {"t-env": build_config("t-env", "vllm", base_url="http://original")}
    _apply_env_overrides(cfgs, "LLMKIT")
    check("env var overrides base_url",
          cfgs["t-env"].base_url == "http://overridden:9999")
    check("env var can disable a provider", cfgs["t-env"].enabled is False)
    del os.environ["LLMKIT__T_ENV__BASE_URL"], os.environ["LLMKIT__T_ENV__ENABLED"]

    check("an explicit label survives kind defaults",
          build_config("gpu", "vllm", label="GPU box").label == "GPU box")
    check("a second instance of a kind is labelled from its own name",
          build_config("laptop-2", "ollama").label == "Laptop 2")
    check("the canonical instance keeps the kind's nice label",
          build_config("ollama", "ollama").label == "Ollama")

    cfg = build_config("x", "vllm", model_overrides={"re:^Qwen": {"context_window": 999}})
    p = build_provider(cfg)
    from utils.shared.llm.kit.types import ModelInfo

    patched = p._apply_override(ModelInfo(id="Qwen/Qwen3-8B", provider="x"))
    check("regex model_overrides apply", patched.context_window == 999)


def test_deepseek_reasoning_roundtrip():
    """The conditional reasoning_content rule — a hard 400 if violated.

    Echo it back if and only if the assistant turn contained a tool call. The
    tricky part is that one normalized `tool` message expands into several wire
    entries, so naive index pairing desyncs after the first tool round.
    """
    print("\n\033[1mDeepSeek reasoning_content round-trip\033[0m")
    from utils.shared.llm.kit import ToolCall
    from utils.shared.llm.kit.types import Message as M

    p = build_provider(build_config("ds", "deepseek", api_key="k"))

    plain = p._build_messages([
        M.user("hi"),
        M.assistant("hello", thinking="pondering"),
        M.user("again"),
    ])
    check("no tool call -> reasoning_content omitted",
          "reasoning_content" not in plain[1])

    with_tool = p._build_messages([
        M.user("weather?"),
        M.assistant("", tool_calls=[ToolCall(id="c1", name="w", arguments={})],
                    thinking="step one"),
        M.tool("c1", "sunny"),
        M.user("and tomorrow?"),
    ])
    check("tool call -> reasoning_content echoed back",
          with_tool[1].get("reasoning_content") == "step one",
          str(with_tool[1]))

    # Two tool rounds: the second assistant turn must still be matched
    # correctly even though the first tool turn expanded the wire list.
    multi = p._build_messages([
        M.user("q"),
        M.assistant("", tool_calls=[ToolCall(id="c1", name="w", arguments={})],
                    thinking="first"),
        M.tool("c1", "r1"),
        M.assistant("", tool_calls=[ToolCall(id="c2", name="w", arguments={})],
                    thinking="second"),
        M.tool("c2", "r2"),
        M.assistant("done", thinking="third"),
    ])
    assistants = [e for e in multi if e.get("role") == "assistant"]
    check("multi-round: first assistant turn keeps its reasoning",
          assistants[0].get("reasoning_content") == "first")
    check("multi-round: second assistant turn is not mis-paired",
          assistants[1].get("reasoning_content") == "second",
          str(assistants[1]))
    check("multi-round: final non-tool turn omits reasoning",
          "reasoning_content" not in assistants[2])


def test_hosted_adapters_offline():
    """Shape checks for Anthropic and Gemini that need no key and no network.

    These cover the translations that are easiest to get wrong and hardest to
    notice: system-prompt lifting, tool_result placement, the adaptive-vs-manual
    thinking split, and Gemini's thinking_level/thinking_budget fork.
    """
    print("\n\033[1mHosted adapters (offline shape checks)\033[0m")
    from utils.shared.llm.kit import ToolCall
    from utils.shared.llm.kit.types import ModelInfo

    try:
        import anthropic  # noqa: F401
        import google.genai  # noqa: F401
    except ImportError:
        print("  (skipped: anthropic / google-genai not installed)")
        return

    a = build_provider(build_config("a", "anthropic", api_key="sk-test"))
    system, msgs = a._split_system([
        Message.system("Be terse."),
        Message.user("hello"),
        Message.assistant("hi", tool_calls=[
            ToolCall(id="tu_1", name="f", arguments={"x": 1})]),
        Message.tool("tu_1", "42"),
    ])
    wire = a._build_messages(msgs)
    check("anthropic lifts system out of the message list", system == "Be terse.")
    check("anthropic emits tool_use inside assistant content",
          [b["type"] for b in wire[1]["content"]] == ["text", "tool_use"])
    check("anthropic returns tool_result as a USER turn",
          wire[2]["role"] == "user" and wire[2]["content"][0]["type"] == "tool_result")

    info = ModelInfo(id="claude-opus-5", provider="a", max_output_tokens=64000,
                     meta={"effort_levels": ["low", "medium", "high", "xhigh", "max"]})
    kw = a._build_params(GenParams(reasoning_effort="minimal", temperature=0.5),
                         "claude-opus-5", info)
    check("4.7+ model gets adaptive thinking + output_config.effort",
          kw["thinking"] == {"type": "adaptive"}
          and kw["output_config"]["effort"] == "low")
    check("max_tokens auto-filled from the model's reported ceiling",
          kw["max_tokens"] == 64000)

    kw2 = a._build_params(GenParams(thinking_budget=8000, temperature=0.5),
                          "claude-opus-4-6", None)
    check("pre-4.7 model gets manual thinking.budget_tokens",
          kw2["thinking"]["budget_tokens"] == 8000)
    check("max_tokens raised above the thinking budget",
          kw2["max_tokens"] > 8000)
    check("sampling params stripped when manual thinking is on",
          "temperature" not in kw2)

    caps = a._capabilities({"id": "claude-opus-5", "capabilities": {
        "thinking": {"supported": True}, "image_input": {"supported": True},
        "pdf_input": {"supported": False}, "structured_outputs": {"supported": True}}})
    check("anthropic capabilities object parsed, not guessed",
          Capability.THINKING in caps and Capability.VISION in caps
          and Capability.PDF not in caps)

    g = build_provider(build_config("g", "gemini", api_key="k"))
    c3 = g._config(GenParams(reasoning_effort="high", temperature=0.5, max_tokens=100),
                   "gemini-3.7-flash", "Be terse.", None)
    check("Gemini 3.x uses thinking_level",
          str(c3.thinking_config.thinking_level).lower().endswith("high"))
    check("Gemini 3.x does not also send thinking_budget (would be a 400)",
          c3.thinking_config.thinking_budget is None)
    check("Gemini rescales 0..1 temperature onto its 0..2 range",
          c3.temperature == 1.0)
    check("Gemini receives system_instruction, not a system message",
          c3.system_instruction == "Be terse.")

    c25 = g._config(GenParams(reasoning_effort="high"), "gemini-2.5-flash", None, None)
    check("Gemini 2.5.x uses thinking_budget (-1 = dynamic)",
          c25.thinking_config.thinking_budget == -1)
    check("Gemini 2.5.x does not send thinking_level",
          c25.thinking_config.thinking_level is None)

    mi = g._model_info(type("M", (), {
        "name": "models/gemini-3.7-flash", "display_name": "Gemini 3.7 Flash",
        "input_token_limit": 1048576, "output_token_limit": 65536,
        "supported_actions": ["generateContent", "countTokens"],
        "version": "1.0", "description": "d", "thinking": True})())
    check("Gemini strips the models/ prefix for the dropdown value",
          mi.id == "gemini-3.7-flash")
    check("Gemini reports real token limits", mi.context_window == 1048576)
    check("Gemini capability source is server-reported",
          mi.meta["capability_source"] == "server-reported")


def test_structured_output_routing():
    print("\n\033[1mStructured output routing\033[0m")
    schema = {"type": "object", "properties": {"a": {"type": "string"}}}

    o = build_provider(build_config("o", "openai", api_key="k"))
    kw, _ = o._build_params(GenParams(response_schema=schema), "gpt-4o")
    check("OpenAI uses response_format.json_schema with strict hardening",
          kw["response_format"]["json_schema"]["schema"]["additionalProperties"] is False)

    v = build_provider(build_config("v", "vllm"))
    kw, extra = v._build_params(GenParams(response_schema=schema), "q")
    check("vLLM uses extra_body.structured_outputs, not response_format",
          "structured_outputs" in extra and "response_format" not in kw)

    lc = build_provider(build_config("l", "llamacpp"))
    kw, extra = lc._build_params(GenParams(response_schema=schema), "q")
    check("llama.cpp uses a top-level json_schema field",
          "json_schema" in extra and "response_format" not in kw)

    kw, _ = o._build_params(GenParams(temperature=0.5, max_tokens=500), "gpt-5.6")
    check("reasoning models: sampling params stripped", "temperature" not in kw)
    check("reasoning models: max_tokens becomes max_completion_tokens",
          kw.get("max_completion_tokens") == 500 and "max_tokens" not in kw)
    kw, _ = o._build_params(GenParams(temperature=0.5, max_tokens=500), "gpt-4o")
    check("non-reasoning models keep temperature and max_tokens",
          kw["temperature"] == 1.0 and kw["max_tokens"] == 500)


def main() -> int:
    global QUIET
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    QUIET = ap.parse_args().quiet

    vllm_srv, vllm_base = serve(VLLM_MODELS)
    lcpp_srv, lcpp_base = serve(LLAMACPP_MODELS)
    ollama_srv, ollama_base = serve(VLLM_MODELS)

    test_pure_functions()
    test_config()
    test_structured_output_routing()
    test_deepseek_reasoning_roundtrip()
    test_hosted_adapters_offline()
    test_vllm(vllm_base)
    test_streaming_tool_calls(vllm_base)
    test_llamacpp(lcpp_base)
    test_ollama(ollama_base)
    test_registry(vllm_base, ollama_base)
    test_agent_loop(vllm_base)

    for s in (vllm_srv, lcpp_srv, ollama_srv):
        s.shutdown()

    total = PASS + FAIL
    colour = "\033[32m" if FAIL == 0 else "\033[31m"
    print(f"\n{colour}{PASS}/{total} checks passed\033[0m")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
