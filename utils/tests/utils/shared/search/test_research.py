from unittest.mock import MagicMock, patch

from utils.shared.search.config import SearchConfig
from utils.shared.search.research import run_research
from utils.shared.search.searxng_client import SearxResult


def _config(max_rounds: int = 3) -> SearchConfig:
    return SearchConfig(
        searxng_base_url="http://localhost:8080",
        max_results=10,
        max_rounds=max_rounds,
        page_max_chars=5000,
        page_timeout_seconds=10,
        page_max_bytes=2_000_000,
        user_agent="test",
    )


@patch("utils.shared.search.research.search_searxng")
@patch("utils.shared.search.research.fetch_page_text")
def test_run_research_stops_early_when_sufficient(mock_fetch, mock_search):
    mock_search.return_value = [
        SearxResult(title="A", url="https://a.test", snippet="snippet a"),
        SearxResult(title="B", url="https://b.test", snippet="snippet b"),
    ]

    def fake_fetch(url, **kwargs):
        from utils.shared.search.page_fetcher import PageContent

        return PageContent(
            url=url,
            title=url,
            text="x" * 600,
            success=True,
        )

    mock_fetch.side_effect = fake_fetch

    result = run_research("widgets", config=_config())

    assert result.rounds_used == 1
    assert len(result.sources) == 2
    assert result.sources[0].index == 1
    assert result.sources[1].index == 2
    mock_search.assert_called_once()


@patch("utils.shared.search.research.search_searxng")
@patch("utils.shared.search.research.fetch_page_text")
def test_run_research_dedupes_urls(mock_fetch, mock_search):
    mock_search.side_effect = [
        [SearxResult(title="A", url="https://a.test", snippet="s1")],
        [SearxResult(title="A again", url="https://a.test", snippet="s2")],
        [SearxResult(title="A third", url="https://a.test", snippet="s3")],
    ]
    mock_fetch.return_value = MagicMock(
        url="https://a.test",
        title="A",
        text="short",
        success=True,
    )

    result = run_research("widgets", config=_config(max_rounds=3))

    assert result.rounds_used == 3
    assert len(result.sources) == 1


@patch("utils.shared.search.research.search_searxng")
def test_run_research_handles_searx_failure(mock_search):
    from utils.shared.search.searxng_client import SearxngError

    mock_search.side_effect = SearxngError("offline")

    result = run_research("widgets", config=_config())

    assert result.sources == []
    assert result.error == "offline"
