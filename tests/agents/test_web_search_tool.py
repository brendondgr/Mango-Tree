from unittest.mock import patch

from agents.schemas.agent import ToolResult
from agents.tools.registry import registry
from utils.shared.search.research import ResearchResult, ResearchSource


@patch("agents.tools.web_search.run_research")
def test_search_web_tool_returns_numbered_sources(mock_run_research):
    mock_run_research.return_value = ResearchResult(
        query="python asyncio",
        rounds_used=1,
        sources=[
            ResearchSource(
                index=1,
                title="Asyncio docs",
                url="https://docs.python.org/3/library/asyncio.html",
                snippet="snippet",
                excerpt="excerpt text",
            )
        ],
    )

    result: ToolResult = registry.execute(
        "search_web",
        {"query": "python asyncio", "citation_offset": 0},
    )

    assert result.success is True
    assert result.result["sources"][0]["index"] == 1
    mock_run_research.assert_called_once_with(
        "python asyncio",
        citation_offset=0,
    )


@patch("agents.tools.web_search.run_research")
def test_search_web_tool_applies_citation_offset(mock_run_research):
    mock_run_research.return_value = ResearchResult(
        query="test",
        rounds_used=1,
        sources=[
            ResearchSource(
                index=3,
                title="Third",
                url="https://example.com",
                snippet="",
                excerpt="text",
            )
        ],
    )

    registry.execute("search_web", {"query": "test", "citation_offset": 2})
    mock_run_research.assert_called_once_with("test", citation_offset=2)


def test_search_web_tool_requires_query():
    result = registry.execute("search_web", {"query": "  "})
    assert result.success is False
