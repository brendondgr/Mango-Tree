from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_BASE_URL = "http://localhost:9090/v1"
DEFAULT_MODEL = "local-model"


@dataclass(frozen=True)
class LlmConfig:
    base_url: str
    model: str
    api_key: str | None = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_yaml_defaults() -> dict[str, str]:
    models_path = _repo_root() / "config" / "models.yaml"
    if not models_path.is_file():
        return {}

    with models_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    provider_name = data.get("default_provider", "local")
    providers = data.get("providers") or {}
    provider = providers.get(provider_name) or {}
    return {
        "base_url": provider.get("base_url", DEFAULT_BASE_URL),
        "model": provider.get("model", DEFAULT_MODEL),
    }


def load_llm_config() -> LlmConfig:
    yaml_defaults = _load_yaml_defaults()
    base_url = os.environ.get("LLM_BASE_URL", yaml_defaults.get("base_url", DEFAULT_BASE_URL))
    model = os.environ.get("LLM_MODEL", yaml_defaults.get("model", DEFAULT_MODEL))
    api_key = os.environ.get("LLM_API_KEY") or None
    return LlmConfig(base_url=base_url.rstrip("/"), model=model, api_key=api_key)
