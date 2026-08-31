"""Provider configuration: declarative, file-driven, environment-aware.

The design goal is that adding a new endpoint to an app is a YAML edit, not a
code change. `providers.yaml` ships with sane defaults for every supported
kind; an app overlays its own file and/or environment variables.

Precedence (later wins):
    built-in defaults  <  providers.yaml  <  environment variables  <  code
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Optional

from .errors import ConfigError
from .params import GenParams

# Provider "kinds" the registry knows how to instantiate.
KINDS = (
    "openai",             # api.openai.com (Responses / Chat Completions)
    "anthropic",          # api.anthropic.com Messages
    "gemini",             # google-genai, Developer API or Vertex/Enterprise
    "openai_compatible",  # generic /v1 server
    "vllm",
    "llamacpp",
    "ollama",
    "deepseek",
    "azure_openai",
)


@dataclass
class ProviderConfig:
    """Everything needed to talk to one endpoint."""

    name: str                                  # unique key, e.g. "local-vllm"
    kind: str                                  # one of KINDS
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    api_key_env: Optional[str] = None          # read at build time if api_key unset
    default_model: Optional[str] = None
    label: Optional[str] = None                # display name for a UI

    # --- transport ---------------------------------------------------------
    timeout: float = 120.0
    connect_timeout: float = 10.0
    max_retries: int = 2
    extra_headers: dict[str, str] = field(default_factory=dict)
    verify_ssl: bool = True

    # --- behaviour ---------------------------------------------------------
    params: GenParams = field(default_factory=GenParams)
    # Pass GenParams.temperature straight through instead of rescaling 0..1
    # onto the provider's native range.
    native_temperature: bool = False
    # Turn "parameter dropped" warnings into exceptions.
    strict_params: bool = False
    # OpenAI only: use /v1/responses instead of /v1/chat/completions.
    use_responses_api: bool = False
    # Gemini only.
    vertex: bool = False
    project: Optional[str] = None
    location: Optional[str] = None
    # Azure only.
    api_version: Optional[str] = None

    # --- discovery ---------------------------------------------------------
    discovery_ttl: float = 300.0               # seconds; 0 disables caching
    # Regexes applied to model ids after discovery.
    model_allow: list[str] = field(default_factory=list)
    model_deny: list[str] = field(default_factory=list)
    # Used when discovery is impossible (unreachable server, no /models route).
    fallback_models: list[str] = field(default_factory=list)
    # Hand-written metadata merged onto discovered models, keyed by model id
    # or by a regex prefixed with "re:". Use this to supply context windows
    # for providers that do not report them.
    model_overrides: dict[str, dict[str, Any]] = field(default_factory=dict)

    enabled: bool = True
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.kind not in KINDS:
            raise ConfigError(
                f"Unknown provider kind {self.kind!r} for {self.name!r}. "
                f"Expected one of: {', '.join(KINDS)}"
            )
        if self.api_key is None and self.api_key_env:
            self.api_key = os.environ.get(self.api_key_env)
        if self.label is None:
            self.label = self.name.replace("-", " ").replace("_", " ").title()

    # ------------------------------------------------------------------
    def resolved_base_url(self) -> Optional[str]:
        """Base URL with the /v1 suffix normalized for OpenAI-style servers.

        Local servers are routinely configured as `http://host:8000` when the
        SDK needs `http://host:8000/v1` — a mistake that surfaces as a
        confusing 404 on every call. Ollama's *native* API sits at the bare
        root, so `kind: ollama` is exempt.
        """
        if not self.base_url:
            return None
        url = self.base_url.rstrip("/")
        needs_v1 = self.kind in (
            "openai_compatible", "vllm", "llamacpp", "deepseek", "openai",
        )
        if needs_v1 and not url.endswith(("/v1", "/beta", "/openai")):
            url = f"{url}/v1"
        return url

    def effective_key(self) -> str:
        """API key, with a placeholder for local servers that ignore auth.

        The openai SDK raises client-side on a falsy api_key even when the
        target server does not check it, so an unauthenticated vLLM or
        llama.cpp instance still needs a dummy string.
        """
        if self.api_key:
            return self.api_key
        if self.kind in ("vllm", "llamacpp", "ollama", "openai_compatible"):
            return "not-needed"
        raise ConfigError(
            f"No API key for provider {self.name!r}. "
            f"Set it directly or via api_key_env"
            + (f" ({self.api_key_env})" if self.api_key_env else "")
            + ".",
            provider=self.name,
        )

    def with_(self, **kw: Any) -> "ProviderConfig":
        return replace(self, **kw)

    def redacted(self) -> dict[str, Any]:
        """Safe-to-log / safe-to-ship-to-a-frontend view."""
        return {
            "name": self.name,
            "kind": self.kind,
            "label": self.label,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "enabled": self.enabled,
            "has_key": bool(self.api_key),
            "vertex": self.vertex,
        }


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------


DEFAULTS: dict[str, dict[str, Any]] = {
    "openai": {
        "api_key_env": "OPENAI_API_KEY",
        "base_url": None,
        "label": "OpenAI",
    },
    "anthropic": {
        "api_key_env": "ANTHROPIC_API_KEY",
        "label": "Claude",
    },
    "gemini": {
        "api_key_env": "GEMINI_API_KEY",
        "label": "Gemini",
    },
    "deepseek": {
        "api_key_env": "DEEPSEEK_API_KEY",
        "base_url": "https://api.deepseek.com",
        "label": "DeepSeek",
    },
    "vllm": {
        "base_url": "http://localhost:8000/v1",
        "api_key_env": "VLLM_API_KEY",
        "label": "vLLM",
    },
    "llamacpp": {
        "base_url": "http://localhost:8080/v1",
        "api_key_env": "LLAMACPP_API_KEY",
        "label": "llama.cpp",
    },
    "ollama": {
        "base_url": "http://localhost:11434",
        "api_key_env": "OLLAMA_API_KEY",
        "label": "Ollama",
    },
    "openai_compatible": {
        "label": "OpenAI-compatible",
    },
    "azure_openai": {
        "api_key_env": "AZURE_OPENAI_API_KEY",
        "label": "Azure OpenAI",
    },
}


def build_config(name: str, kind: str, **kw: Any) -> ProviderConfig:
    """Construct a ProviderConfig with kind-appropriate defaults filled in."""
    merged: dict[str, Any] = dict(DEFAULTS.get(kind, {}))
    # The kind's default label ("Ollama", "vLLM") is only a sensible display
    # name when the provider is *the* instance of that kind. With two Ollama
    # hosts registered, both would render as "Ollama"; fall back to the
    # provider's own name instead.
    if name != kind and "label" not in kw:
        merged.pop("label", None)
    merged.update({k: v for k, v in kw.items() if v is not None})
    params = merged.pop("params", None)
    if isinstance(params, dict):
        extra = params.pop("extra", {}) or {}
        params = GenParams(**params, extra=extra)
    cfg = ProviderConfig(name=name, kind=kind, **merged)
    if params is not None:
        cfg.params = params
    return cfg


def load_configs(
    path: Optional[str | Path] = None,
    *,
    env_prefix: str = "LLMKIT",
) -> dict[str, ProviderConfig]:
    """Load provider configs from a YAML file, then apply env overrides.

    YAML shape:

        providers:
          openai:
            kind: openai
            api_key_env: OPENAI_API_KEY
            default_model: gpt-5.6
          workstation-vllm:
            kind: vllm
            base_url: http://10.0.0.4:8000/v1
            params:
              temperature: 0.7
              extra:
                vllm: {top_k: 40}

    Env overrides use `LLMKIT__<PROVIDER>__<FIELD>`, e.g.
    `LLMKIT__WORKSTATION_VLLM__BASE_URL=http://localhost:8000/v1`.
    A bare `LLMKIT__<PROVIDER>__ENABLED=0` disables one without editing YAML.
    """
    data: dict[str, Any] = {}
    if path:
        p = Path(path)
        if not p.exists():
            raise ConfigError(f"Config file not found: {p}")
        data = _read_yaml(p)
    elif (default := Path(__file__).with_name("providers.yaml")).exists():
        data = _read_yaml(default)

    raw = data.get("providers", {}) or {}
    configs: dict[str, ProviderConfig] = {}
    for name, spec in raw.items():
        spec = dict(spec or {})
        kind = spec.pop("kind", name)
        configs[name] = build_config(name, kind, **spec)

    _apply_env_overrides(configs, env_prefix)
    return configs


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise ConfigError(
            "PyYAML is required to load providers.yaml (pip install pyyaml), "
            "or build ProviderConfig objects in code instead."
        ) from exc
    with path.open() as fh:
        return yaml.safe_load(fh) or {}


_BOOL_FIELDS = {
    "enabled", "vertex", "use_responses_api", "strict_params",
    "native_temperature", "verify_ssl",
}
_FLOAT_FIELDS = {"timeout", "connect_timeout", "discovery_ttl"}
_INT_FIELDS = {"max_retries"}


def _apply_env_overrides(
    configs: dict[str, ProviderConfig], prefix: str
) -> None:
    marker = f"{prefix}__"
    for key, value in os.environ.items():
        if not key.startswith(marker):
            continue
        try:
            _, provider_part, field_part = key.split("__", 2)
        except ValueError:
            continue
        field_name = field_part.lower()
        target = None
        for name, cfg in configs.items():
            if name.upper().replace("-", "_") == provider_part.upper():
                target = cfg
                break
        if target is None:
            continue
        if field_name in _BOOL_FIELDS:
            setattr(target, field_name, value.strip().lower() in ("1", "true", "yes", "on"))
        elif field_name in _FLOAT_FIELDS:
            setattr(target, field_name, float(value))
        elif field_name in _INT_FIELDS:
            setattr(target, field_name, int(value))
        elif hasattr(target, field_name):
            setattr(target, field_name, value)
