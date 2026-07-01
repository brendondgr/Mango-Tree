"""Pure interval math for the time tracker.

The tracker UI paints a day as a set of 5-minute block indices (0 == 00:00 …
287 == 23:55), each tagged with a category/subcategory. Saving a day turns those
painted blocks into ``time_logs`` rows: contiguous blocks that share the same
(category, subcategory) collapse into a single row spanning their combined
duration.

This module is the single source of truth for that transformation — it has no
Django or Flask dependency and is unit-tested in isolation. It was extracted from
the legacy ``POST /api/logs`` handler, preserving its exact grouping behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass

from utils.apps.timekeeper.shared.constants import BLOCK_MINUTES


@dataclass(frozen=True)
class Interval:
    """A single painted 5-minute block."""

    index: int
    category_id: str | None = None
    subcategory_id: str | None = None


@dataclass(frozen=True)
class Chunk:
    """A contiguous run of blocks sharing one (category, subcategory)."""

    start_index: int
    end_index: int
    category_id: str | None
    subcategory_id: str | None

    @property
    def start_time(self) -> str:
        return index_to_hhmm(self.start_index)

    @property
    def duration(self) -> int:
        """Minutes covered, inclusive of both endpoints."""
        return (self.end_index - self.start_index + 1) * BLOCK_MINUTES


def index_to_hhmm(index: int) -> str:
    """Convert a 5-minute block index into an ``HH:MM`` start time."""
    minutes = index * BLOCK_MINUTES
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def group_intervals(intervals: list[Interval]) -> list[Chunk]:
    """Collapse painted blocks into contiguous same-subcategory chunks.

    Blocks are sorted by index; a run is extended only while the next index is
    exactly one greater AND the category and subcategory are unchanged. Matches
    the legacy handler's chunking exactly.
    """
    if not intervals:
        return []

    ordered = sorted(intervals, key=lambda iv: iv.index)

    chunks: list[Chunk] = []
    start = ordered[0].index
    end = start
    cat = ordered[0].category_id
    subcat = ordered[0].subcategory_id

    for iv in ordered[1:]:
        if iv.index == end + 1 and iv.category_id == cat and iv.subcategory_id == subcat:
            end = iv.index
        else:
            chunks.append(Chunk(start, end, cat, subcat))
            start = iv.index
            end = iv.index
            cat = iv.category_id
            subcat = iv.subcategory_id

    chunks.append(Chunk(start, end, cat, subcat))
    return chunks
