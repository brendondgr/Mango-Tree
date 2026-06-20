from utils.agents.schemas.agent import ToolResult
from utils.agents.tools.registry import registry
from utils.shared.search.research import run_research


@registry.register("search_web")
def search_web(query: str, citation_offset: int = 0) -> ToolResult:
    if not query or not query.strip():
        return ToolResult(
            success=False,
            result={},
            summary="Error: 'query' is a required argument but was not provided.",
            artifact_ids=[],
        )

    research = run_research(query.strip(), citation_offset=citation_offset)
    sources = [
        {
            "index": source.index,
            "title": source.title,
            "url": source.url,
            "snippet": source.snippet,
            "excerpt": source.excerpt,
        }
        for source in research.sources
    ]

    if not sources:
        message = research.error or "No web sources could be retrieved."
        return ToolResult(
            success=False,
            result={
                "query": research.query,
                "rounds_used": research.rounds_used,
                "sources": [],
                "error": message,
            },
            summary=f"Web search failed: {message}",
            artifact_ids=[],
        )

    round_label = "round" if research.rounds_used == 1 else "rounds"
    return ToolResult(
        success=True,
        result={
            "query": research.query,
            "rounds_used": research.rounds_used,
            "sources": sources,
        },
        summary=(
            f"Web search returned {len(sources)} source(s) in "
            f"{research.rounds_used} {round_label}."
        ),
        artifact_ids=[],
    )
