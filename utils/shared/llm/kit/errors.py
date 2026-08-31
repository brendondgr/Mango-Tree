"""One exception hierarchy for every provider.

Every adapter catches its SDK's native exceptions and re-raises one of these.
Application code should never need to `import openai` or `import anthropic`
just to write an `except` clause.

`retryable` is the field that matters: it drives `retry.py` and any circuit
breaker or fallback chain you build on top.
"""

from __future__ import annotations

from typing import Any, Optional


class LLMError(Exception):
    """Base for everything raised by llmkit."""

    retryable: bool = False

    def __init__(
        self,
        message: str,
        *,
        provider: str = "",
        model: str = "",
        status_code: Optional[int] = None,
        request_id: Optional[str] = None,
        retry_after: Optional[float] = None,
        raw: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.model = model
        self.status_code = status_code
        self.request_id = request_id
        self.retry_after = retry_after
        self.raw = raw

    def __str__(self) -> str:
        bits = [self.message]
        ctx = ", ".join(
            f"{k}={v}"
            for k, v in (
                ("provider", self.provider),
                ("model", self.model),
                ("status", self.status_code),
                ("request_id", self.request_id),
            )
            if v
        )
        if ctx:
            bits.append(f"[{ctx}]")
        return " ".join(bits)


class ConfigError(LLMError):
    """Bad or missing configuration — wrong base_url, unset API key env var."""


class AuthError(LLMError):
    """401/403. Never retried: retrying a bad key just burns rate limit."""


class NotFoundError(LLMError):
    """404, including 'model does not exist on this server'."""


class InvalidRequestError(LLMError):
    """400/422. A schema, parameter, or message-shape problem — your bug.

    Deliberately not retryable. The single most common cause across providers
    is sending a parameter the target model does not accept (see
    references/pitfalls.md).
    """


class RateLimitError(LLMError):
    """429. Honour `retry_after` when present."""

    retryable = True


class OverloadedError(LLMError):
    """529 (Anthropic) / 503. The service is up but shedding load."""

    retryable = True


class ServerError(LLMError):
    """5xx."""

    retryable = True


class ConnectionError_(LLMError):
    """DNS, refused connection, TLS. Very common with local servers that
    simply are not running — check `Provider.health()` before blaming code."""

    retryable = True


class TimeoutError_(LLMError):
    """Request exceeded the configured timeout."""

    retryable = True


class ContentFilterError(LLMError):
    """The provider blocked the prompt or the completion on safety grounds.

    Gemini surfaces this as an empty candidate list with a `block_reason`
    rather than an HTTP error, which is why it gets its own type — otherwise
    it looks like a mysterious empty response.
    """


class ContextLengthError(InvalidRequestError):
    """Prompt exceeded the model's context window."""


class CapabilityError(LLMError):
    """The requested operation is not supported by this provider/model.

    Example: asking a llama.cpp server for embeddings when it was started
    without `--embedding`, or requesting tool calls from a vLLM server started
    without `--enable-auto-tool-choice`.
    """


class ToolExecutionError(LLMError):
    """A tool callable raised during an agent loop."""


def classify_status(status: Optional[int], message: str = "") -> type[LLMError]:
    """Map an HTTP status to an llmkit exception class.

    Used by adapters that talk raw HTTP (local servers) rather than through a
    vendor SDK.
    """
    if status is None:
        return LLMError
    if status in (401,):
        return AuthError
    if status in (403,):
        return AuthError
    if status == 404:
        return NotFoundError
    if status in (400, 422):
        low = message.lower()
        if "context" in low and ("length" in low or "size" in low or "window" in low):
            return ContextLengthError
        return InvalidRequestError
    if status == 429:
        return RateLimitError
    if status == 529:
        return OverloadedError
    if status >= 500:
        return ServerError
    return LLMError
