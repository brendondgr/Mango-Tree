from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import requests

from utils.shared.search.config import SearchConfig, load_search_config


@dataclass(frozen=True)
class SearxResult:
    title: str
    url: str
    snippet: str


class SearxngError(Exception):
    pass


def search_searxng(
    query: str,
    *,
    config: SearchConfig | None = None,
    session: requests.Session | None = None,
) -> list[SearxResult]:
    if not query.strip():
        raise SearxngError("Search query must not be empty.")

    cfg = config or load_search_config()
    http = session or requests.Session()
    params = urlencode({"q": query.strip(), "format": "json"})
    url = f"{cfg.searxng_base_url}/search?{params}"

    try:
        response = http.get(url, timeout=cfg.page_timeout_seconds)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SearxngError(f"SearXNG request failed: {exc}") from exc

    try:
        payload: dict[str, Any] = response.json()
    except ValueError as exc:
        raise SearxngError("SearXNG returned non-JSON response.") from exc

    raw_results = payload.get("results") or []
    if not isinstance(raw_results, list):
        raise SearxngError("SearXNG results payload is malformed.")

    results: list[SearxResult] = []
    for item in raw_results[: cfg.max_results]:
        if not isinstance(item, dict):
            continue
        result_url = str(item.get("url") or "").strip()
        if not result_url:
            continue
        title = str(item.get("title") or result_url).strip()
        snippet = str(item.get("content") or item.get("snippet") or "").strip()
        results.append(SearxResult(title=title, url=result_url, snippet=snippet))

    return results
