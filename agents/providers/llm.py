import os
import json
import requests
from typing import List, Dict, Any, Optional

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:9090/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "default-model")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

class LLMProviderError(Exception):
    pass

def get_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    return headers

def chat_complete(
    messages: List[Dict[str, Any]], 
    tools: Optional[List[Dict[str, Any]]] = None,
    stream: bool = False
) -> Any:
    """
    Sends a chat completion request to the OpenAI-compatible endpoint.
    If stream=True and not calling tools, it returns a generator yielding content/thinking.
    """
    url = f"{LLM_BASE_URL}/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": stream
    }
    if tools:
        payload["tools"] = tools
        # Disable streaming if LLM tool calling doesn't support streaming easily,
        # or handle tool call streams. For simplicity, we disable stream when tools are used.
        payload["stream"] = False

    try:
        response = requests.post(url, json=payload, headers=get_headers(), timeout=30)
        if response.status_code != 200:
            raise LLMProviderError(f"LLM request failed with status {response.status_code}: {response.text}")
        
        if payload["stream"]:
            return response # Caller can process the stream
        else:
            return response.json()
    except requests.exceptions.RequestException as e:
        # Fallback/simulation if server is offline, so the platform can run
        print(f"LLM connection error: {e}")
        raise LLMProviderError(
            f"Could not reach LLM at {url}. Ensure your local model server (Llama-CPP/Ollama) is running."
        )
