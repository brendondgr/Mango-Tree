import os
import json
import requests
from typing import List, Dict, Any, Optional, Union

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:9090/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "default-model")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

class LLMProviderError(Exception):
    pass


def _resolve_config(config: Optional[Union[Dict[str, Any], Any]]) -> Dict[str, str]:
    """
    Determine the effective base URL / model / API key for a request.

    A per-request ``config`` (forwarded from the frontend settings) takes
    precedence; any field it omits falls back to the environment defaults.
    Accepts either a plain dict or an object exposing ``base_url`` / ``model`` /
    ``api_key`` attributes (e.g. ``utils.shared.llm.config.LlmConfig``).
    """
    base_url = LLM_BASE_URL
    model = LLM_MODEL
    api_key = LLM_API_KEY

    if config is not None:
        if isinstance(config, dict):
            raw_base = config.get("base_url")
            raw_model = config.get("model")
            raw_key = config.get("api_key")
        else:
            raw_base = getattr(config, "base_url", None)
            raw_model = getattr(config, "model", None)
            raw_key = getattr(config, "api_key", None)

        if isinstance(raw_base, str) and raw_base.strip():
            base_url = raw_base.strip().rstrip("/")
        if isinstance(raw_model, str) and raw_model.strip():
            model = raw_model.strip()
        if isinstance(raw_key, str):
            api_key = raw_key.strip()

    return {"base_url": base_url, "model": model, "api_key": api_key}


def get_headers(api_key: Optional[str] = None) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    effective_key = LLM_API_KEY if api_key is None else api_key
    if effective_key:
        headers["Authorization"] = f"Bearer {effective_key}"
    return headers

def chat_complete(
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
    stream: bool = False,
    config: Optional[Union[Dict[str, Any], Any]] = None,
) -> Any:
    """
    Sends a chat completion request to the OpenAI-compatible endpoint.
    Supports streaming for token-by-token reasoning/thinking and tool calls.

    ``config`` optionally overrides the base URL / model / API key for this
    request (forwarded from the user's saved settings); it falls back to the
    ``LLM_*`` environment defaults for any missing field.
    """
    resolved = _resolve_config(config)
    url = f"{resolved['base_url']}/chat/completions"
    payload = {
        "model": resolved["model"],
        "messages": messages,
        "stream": stream
    }
    if tools:
        payload["tools"] = tools

    try:
        response = requests.post(url, json=payload, headers=get_headers(resolved["api_key"]), timeout=30, stream=stream)
        if response.status_code != 200:
            raise LLMProviderError(f"LLM request failed with status {response.status_code}: {response.text}")
        
        if stream:
            return response # Caller can process the stream
        else:
            return response.json()
    except requests.exceptions.RequestException as e:
        # Fallback/simulation if server is offline, so the platform can run
        print(f"LLM connection error: {e}")
        raise LLMProviderError(
            f"Could not reach LLM at {url}. Ensure your local model server (Llama-CPP/Ollama) is running."
        )
