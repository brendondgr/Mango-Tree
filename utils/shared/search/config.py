from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_SEARXNG_BASE_URL = "http://localhost:8080"
DEFAULT_MAX_RESULTS = 10
DEFAULT_MAX_ROUNDS = 3
DEFAULT_PAGE_MAX_CHARS = 5000
DEFAULT_PAGE_TIMEOUT_SECONDS = 10
DEFAULT_PAGE_MAX_BYTES = 2_000_000
DEFAULT_USER_AGENT = "MangoTree/1.0 (local research agent)"


@dataclass(frozen=True)
class SearchConfig:
    searxng_base_url: str
    max_results: int
    max_rounds: int
    page_max_chars: int
    page_timeout_seconds: int
    page_max_bytes: int
    user_agent: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_yaml_defaults() -> dict:
    config_path = repo_root() / "config" / "search.yaml"
    if not config_path.is_file():
        return {}

    with config_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    return data.get("search") or {}


def load_search_config() -> SearchConfig:
    yaml_defaults = _load_yaml_defaults()
    searxng = yaml_defaults.get("searxng") or {}
    research = yaml_defaults.get("research") or {}
    page = yaml_defaults.get("page") or {}

    base_url = os.environ.get(
        "SEARXNG_BASE_URL",
        searxng.get("base_url", DEFAULT_SEARXNG_BASE_URL),
    ).rstrip("/")

    return SearchConfig(
        searxng_base_url=base_url,
        max_results=int(searxng.get("max_results", DEFAULT_MAX_RESULTS)),
        max_rounds=int(research.get("max_rounds", DEFAULT_MAX_ROUNDS)),
        page_max_chars=int(page.get("max_chars", DEFAULT_PAGE_MAX_CHARS)),
        page_timeout_seconds=int(
            page.get("timeout_seconds", DEFAULT_PAGE_TIMEOUT_SECONDS),
        ),
        page_max_bytes=int(page.get("max_bytes", DEFAULT_PAGE_MAX_BYTES)),
        user_agent=str(page.get("user_agent", DEFAULT_USER_AGENT)),
    )
