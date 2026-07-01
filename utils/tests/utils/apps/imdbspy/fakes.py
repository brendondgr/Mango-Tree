"""Test doubles for the IMDbSpy scraper.

The real scraper does network + filesystem I/O; services accept it as an
injectable seam, so unit tests pass ``FakeScraper`` instead and never hit the
network.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any


def make_result(
    imdb_id: str = "0111161",
    title: str = "The Shawshank Redemption",
    kind: str = "movie",
    **overrides: Any,
) -> SimpleNamespace:
    """Build a MediaResult-shaped object with sensible movie defaults."""
    base: dict[str, Any] = dict(
        imdb_id=imdb_id,
        title=title,
        description="A quiet drama.",
        kind=kind,
        genres=["Drama"],
        rating=9.3,
        rating_count=2_800_000,
        creators=[],
        directors=[{"name": "Frank Darabont", "id": "0001104"}],
        writers=[{"name": "Stephen King", "id": "0000175"}],
        seasons=None,
        episodes=None,
        years="1994",
        runtime_minutes=142,
        cast=[{"name": "Tim Robbins", "id": "0000209"}],
        title_image_path="tv-movie/0111161.webp",
        actor_image_paths={"Tim Robbins": "actors/0000209.webp"},
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class FakeScraper:
    """Returns canned results and records the calls made against it.

    ``results`` may be a single result object (returned for any URL) or a dict
    mapping URL/ID -> result. ``refresh`` maps imdb_id -> refresh_metadata dict.
    """

    def __init__(self, results: Any = None, refresh: dict[str, dict] | None = None):
        self._results = results if results is not None else make_result()
        self._refresh = refresh or {}
        self.run_calls: list[str] = []
        self.refresh_calls: list[str] = []

    def run(self, url: str):
        self.run_calls.append(url)
        if isinstance(self._results, dict):
            return self._results[url]
        return self._results

    def refresh_metadata(self, imdb_id: str) -> dict:
        self.refresh_calls.append(imdb_id)
        return self._refresh.get(imdb_id, {})
