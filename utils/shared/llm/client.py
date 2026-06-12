from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from utils.shared.llm.config import LlmConfig


class LlmClientError(Exception):
    pass


class OpenAICompatibleClient:
    def __init__(self, config: LlmConfig | None = None) -> None:
        self.config = config or LlmConfig(
            base_url="http://localhost:9090/v1",
            model="local-model",
        )

    def chat(self, messages: list[dict[str, str]]) -> str:
        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
        }

        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        request = urllib.request.Request(url, data=body, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LlmClientError(f"LLM request failed ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise LlmClientError(f"Could not reach LLM at {url}: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise LlmClientError("LLM returned invalid JSON") from exc

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmClientError(f"Unexpected LLM response shape: {data!r}") from exc
