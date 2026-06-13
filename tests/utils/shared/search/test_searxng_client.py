import json
import requests
from unittest.mock import MagicMock

import pytest

from utils.shared.search.config import SearchConfig
from utils.shared.search.searxng_client import SearxngError, search_searxng


def _mock_response(payload: dict, *, status_code: int = 200):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    response.raise_for_status = MagicMock()
    return response


def test_search_searxng_parses_results():
    session = MagicMock()
    session.get.return_value = _mock_response(
        {
            "results": [
                {
                    "title": "Example",
                    "url": "https://example.com/page",
                    "content": "A helpful snippet",
                },
                {"title": "No URL"},
            ]
        }
    )
    config = SearchConfig(
        searxng_base_url="http://localhost:8080",
        max_results=10,
        max_rounds=3,
        page_max_chars=5000,
        page_timeout_seconds=10,
        page_max_bytes=2_000_000,
        user_agent="test",
    )

    results = search_searxng("test query", config=config, session=session)

    assert len(results) == 1
    assert results[0].title == "Example"
    assert results[0].url == "https://example.com/page"
    assert results[0].snippet == "A helpful snippet"
    session.get.assert_called_once()
    call_url = session.get.call_args[0][0]
    assert call_url.startswith("http://localhost:8080/search?")
    assert "format=json" in call_url


def test_search_searxng_empty_query_raises():
    with pytest.raises(SearxngError, match="empty"):
        search_searxng("   ")


def test_search_searxng_request_failure():
    session = MagicMock()
    session.get.side_effect = requests.exceptions.ConnectionError("connection refused")
    config = SearchConfig(
        searxng_base_url="http://localhost:8080",
        max_results=10,
        max_rounds=3,
        page_max_chars=5000,
        page_timeout_seconds=10,
        page_max_bytes=2_000_000,
        user_agent="test",
    )

    with pytest.raises(SearxngError, match="failed"):
        search_searxng("query", config=config, session=session)
