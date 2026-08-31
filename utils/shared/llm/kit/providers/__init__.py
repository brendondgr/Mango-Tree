"""Provider adapters, mapped by config `kind`.

Imports are lazy so that installing only the SDKs you actually use is enough —
importing llmkit must not require `anthropic` and `google-genai` to be present
just because the registry knows their names.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:  # pragma: no cover
    from ..base import Provider
    from ..config import ProviderConfig


def _openai_like(attr: str) -> Callable[..., "Provider"]:
    def build(config: "ProviderConfig") -> "Provider":
        from . import openai_like

        return getattr(openai_like, attr)(config)

    return build


def _anthropic(config: "ProviderConfig") -> "Provider":
    from .anthropic_provider import AnthropicProvider

    return AnthropicProvider(config)


def _gemini(config: "ProviderConfig") -> "Provider":
    from .gemini_provider import GeminiProvider

    return GeminiProvider(config)


def _ollama(config: "ProviderConfig") -> "Provider":
    from .ollama_provider import OllamaProvider

    return OllamaProvider(config)


BUILDERS: dict[str, Callable[..., "Provider"]] = {
    "openai": _openai_like("OpenAIProvider"),
    "openai_compatible": _openai_like("OpenAICompatible"),
    "vllm": _openai_like("VLLMProvider"),
    "llamacpp": _openai_like("LlamaCppProvider"),
    "deepseek": _openai_like("DeepSeekProvider"),
    "azure_openai": _openai_like("AzureOpenAIProvider"),
    "anthropic": _anthropic,
    "gemini": _gemini,
    "ollama": _ollama,
}


def build_provider(config: "ProviderConfig") -> "Provider":
    from ..errors import ConfigError

    builder = BUILDERS.get(config.kind)
    if builder is None:
        raise ConfigError(
            f"No adapter registered for kind {config.kind!r}. "
            f"Known kinds: {', '.join(sorted(BUILDERS))}"
        )
    return builder(config)


def register_kind(kind: str, builder: Callable[..., "Provider"]) -> None:
    """Add a custom adapter.

        from llmkit.providers import register_kind
        register_kind("my-gateway", lambda cfg: MyGatewayProvider(cfg))
    """
    BUILDERS[kind] = builder


__all__ = ["BUILDERS", "build_provider", "register_kind"]
