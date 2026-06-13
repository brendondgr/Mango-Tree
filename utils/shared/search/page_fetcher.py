from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from utils.shared.search.config import SearchConfig, load_search_config

_BLOCK_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header"}


@dataclass(frozen=True)
class PageContent:
    url: str
    title: str
    text: str
    success: bool
    error: str | None = None


def _is_allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _looks_like_html(content_type: str | None) -> bool:
    if not content_type:
        return True
    lowered = content_type.lower()
    return "html" in lowered or "xml" in lowered


def _extract_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else ""

    for tag in soup.find_all(_BLOCK_TAGS):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return title, text


def fetch_page_text(
    url: str,
    *,
    config: SearchConfig | None = None,
    session: requests.Session | None = None,
) -> PageContent:
    cfg = config or load_search_config()

    if not _is_allowed_url(url):
        return PageContent(
            url=url,
            title="",
            text="",
            success=False,
            error="URL scheme not allowed (http/https only).",
        )

    http = session or requests.Session()
    headers = {"User-Agent": cfg.user_agent, "Accept": "text/html,application/xhtml+xml"}

    try:
        response = http.get(
            url,
            headers=headers,
            timeout=cfg.page_timeout_seconds,
            stream=True,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        return PageContent(
            url=url,
            title="",
            text="",
            success=False,
            error=str(exc),
        )

    content_type = response.headers.get("Content-Type", "")
    if not _looks_like_html(content_type):
        return PageContent(
            url=url,
            title="",
            text="",
            success=False,
            error=f"Unsupported content type: {content_type}",
        )

    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in response.iter_content(chunk_size=8192):
            if not chunk:
                continue
            total += len(chunk)
            if total > cfg.page_max_bytes:
                break
            chunks.append(chunk)
    except requests.RequestException as exc:
        return PageContent(
            url=url,
            title="",
            text="",
            success=False,
            error=str(exc),
        )

    html = b"".join(chunks).decode("utf-8", errors="ignore")
    title, text = _extract_text(html)
    if len(text) > cfg.page_max_chars:
        text = text[: cfg.page_max_chars] + "\n\n... [truncated]"

    return PageContent(url=url, title=title or url, text=text, success=bool(text.strip()))
