"""Retry, timeout, and fallback policy.

Vendor SDKs already retry (OpenAI and Anthropic both default to 2 attempts
with jittered backoff, honouring Retry-After). This module exists for the
things they cannot do:

  * retrying across *providers* — fall back from a hosted API to a local one
  * a uniform policy for raw-HTTP adapters (llama.cpp, Ollama native)
  * a circuit breaker so a dead local server does not add latency to every
    request while it is down
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Optional, TypeVar

from .errors import LLMError, RateLimitError

T = TypeVar("T")


@dataclass
class RetryPolicy:
    attempts: int = 3
    initial_delay: float = 0.5
    max_delay: float = 20.0
    multiplier: float = 2.0
    jitter: float = 0.25
    # Respect a Retry-After / retry_after value from the error when present.
    honour_retry_after: bool = True

    def delay_for(self, attempt: int, err: Optional[LLMError] = None) -> float:
        if (
            self.honour_retry_after
            and isinstance(err, LLMError)
            and err.retry_after
        ):
            return min(float(err.retry_after), self.max_delay)
        base = min(self.initial_delay * (self.multiplier ** attempt), self.max_delay)
        return base * (1 + random.uniform(-self.jitter, self.jitter))


def with_retry(
    fn: Callable[[], T],
    policy: Optional[RetryPolicy] = None,
    *,
    on_retry: Optional[Callable[[int, LLMError, float], None]] = None,
) -> T:
    """Call `fn`, retrying only errors flagged `retryable`.

    Deliberately does NOT retry InvalidRequestError / AuthError: a malformed
    schema will fail identically three times and a bad key just burns quota.
    """
    policy = policy or RetryPolicy()
    last: Optional[LLMError] = None
    for attempt in range(policy.attempts):
        try:
            return fn()
        except LLMError as exc:
            if not exc.retryable or attempt == policy.attempts - 1:
                raise
            last = exc
            delay = policy.delay_for(attempt, exc)
            if on_retry:
                on_retry(attempt + 1, exc, delay)
            time.sleep(delay)
    raise last  # pragma: no cover - unreachable


async def with_retry_async(
    fn: Callable[[], Any],
    policy: Optional[RetryPolicy] = None,
    *,
    on_retry: Optional[Callable[[int, LLMError, float], None]] = None,
) -> Any:
    import asyncio

    policy = policy or RetryPolicy()
    for attempt in range(policy.attempts):
        try:
            return await fn()
        except LLMError as exc:
            if not exc.retryable or attempt == policy.attempts - 1:
                raise
            delay = policy.delay_for(attempt, exc)
            if on_retry:
                on_retry(attempt + 1, exc, delay)
            await asyncio.sleep(delay)


@dataclass
class CircuitBreaker:
    """Stop hammering an endpoint that is clearly down.

    After `threshold` consecutive failures the breaker opens and calls fail
    immediately for `reset_after` seconds. Matters most for local servers: a
    laptop with Ollama not running should not add a 10-second connect timeout
    to every page load of a model picker.
    """

    threshold: int = 3
    reset_after: float = 30.0
    _failures: int = field(default=0, init=False)
    _opened_at: Optional[float] = field(default=None, init=False)

    @property
    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if time.monotonic() - self._opened_at >= self.reset_after:
            self._opened_at = None
            self._failures = 0
            return False
        return True

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self.threshold:
            self._opened_at = time.monotonic()

    def call(self, fn: Callable[[], T]) -> T:
        from .errors import ConnectionError_

        if self.is_open:
            raise ConnectionError_(
                "Circuit open: endpoint failed repeatedly and is being skipped"
            )
        try:
            result = fn()
        except Exception:
            self.record_failure()
            raise
        self.record_success()
        return result


def first_working(
    candidates: Iterable[tuple[str, Callable[[], T]]],
    *,
    policy: Optional[RetryPolicy] = None,
    on_fallback: Optional[Callable[[str, LLMError], None]] = None,
) -> T:
    """Try each candidate in order; return the first success.

    Falls through on retryable errors *and* on capability/not-found errors,
    since "this local server doesn't have that model" is exactly the case
    where you want the next candidate. Re-raises the last error if all fail.

        answer = first_working([
            ("local",  lambda: local.chat(msgs, model="qwen3:8b")),
            ("hosted", lambda: hosted.chat(msgs, model="claude-sonnet-5")),
        ])
    """
    from .errors import CapabilityError, NotFoundError

    last: Optional[LLMError] = None
    for label, fn in candidates:
        try:
            return with_retry(fn, policy)
        except (CapabilityError, NotFoundError, LLMError) as exc:
            if isinstance(exc, LLMError) and not (
                exc.retryable or isinstance(exc, (CapabilityError, NotFoundError))
            ):
                raise
            last = exc
            if on_fallback:
                on_fallback(label, exc)
    if last:
        raise last
    raise LLMError("No candidates supplied to first_working()")
