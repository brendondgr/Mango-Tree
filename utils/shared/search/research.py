from __future__ import annotations

from dataclasses import dataclass, field

import requests

from utils.shared.search.config import SearchConfig, load_search_config
from utils.shared.search.page_fetcher import fetch_page_text
from utils.shared.search.searxng_client import SearxResult, SearxngError, search_searxng


@dataclass
class ResearchSource:
    index: int
    title: str
    url: str
    snippet: str
    excerpt: str


@dataclass
class ResearchResult:
    query: str
    rounds_used: int
    sources: list[ResearchSource] = field(default_factory=list)
    error: str | None = None


def _refine_query(query: str, results: list[SearxResult], round_index: int) -> str:
    if not results:
        return query
    top_title = results[0].title.strip()
    if round_index == 1 and top_title and top_title.lower() not in query.lower():
        return f"{query} {top_title}"
    if round_index == 2:
        return f"{query} details"
    return query


def _is_sufficient(sources: list[ResearchSource]) -> bool:
    substantive = [s for s in sources if len(s.excerpt.strip()) >= 500]
    if len(substantive) >= 2:
        return True
    return any(len(s.excerpt.strip()) >= 1500 for s in sources)


def run_research(
    query: str,
    *,
    citation_offset: int = 0,
    config: SearchConfig | None = None,
    session: requests.Session | None = None,
) -> ResearchResult:
    cfg = config or load_search_config()
    http = session or requests.Session()
    current_query = query.strip()
    merged_by_url: dict[str, ResearchSource] = {}
    rounds_used = 0
    last_error: str | None = None

    for round_index in range(1, cfg.max_rounds + 1):
        rounds_used = round_index
        try:
            searx_results = search_searxng(current_query, config=cfg, session=http)
        except SearxngError as exc:
            last_error = str(exc)
            break

        for result in searx_results:
            if result.url in merged_by_url:
                continue
            page = fetch_page_text(result.url, config=cfg, session=http)
            excerpt = page.text.strip() if page.success else result.snippet.strip()
            index = citation_offset + len(merged_by_url) + 1
            merged_by_url[result.url] = ResearchSource(
                index=index,
                title=result.title or page.title,
                url=result.url,
                snippet=result.snippet,
                excerpt=excerpt,
            )

        sources = list(merged_by_url.values())
        if _is_sufficient(sources):
            break

        if round_index < cfg.max_rounds:
            current_query = _refine_query(current_query, searx_results, round_index)

    sources = list(merged_by_url.values())
    return ResearchResult(
        query=query.strip(),
        rounds_used=rounds_used,
        sources=sources,
        error=last_error if not sources else None,
    )
