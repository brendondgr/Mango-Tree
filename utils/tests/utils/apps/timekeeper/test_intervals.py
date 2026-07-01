"""Unit tests for the pure interval-chunking math (no DB)."""

from __future__ import annotations

from utils.apps.timekeeper.shared.intervals import (
    Interval,
    Chunk,
    group_intervals,
    index_to_hhmm,
)


def test_index_to_hhmm():
    assert index_to_hhmm(0) == "00:00"
    assert index_to_hhmm(1) == "00:05"
    assert index_to_hhmm(12) == "01:00"
    assert index_to_hhmm(287) == "23:55"


def test_empty_intervals_group_to_nothing():
    assert group_intervals([]) == []


def test_contiguous_same_subcat_merges_into_one_chunk():
    ivs = [Interval(i, "cat", "sub") for i in (0, 1, 2, 3)]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 3, "cat", "sub")]
    assert chunks[0].start_time == "00:00"
    assert chunks[0].duration == 20  # 4 blocks * 5 min


def test_gap_splits_chunks():
    ivs = [Interval(0, "c", "s"), Interval(1, "c", "s"), Interval(5, "c", "s")]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 1, "c", "s"), Chunk(5, 5, "c", "s")]
    assert chunks[1].start_time == "00:25"
    assert chunks[1].duration == 5


def test_subcategory_change_splits_even_when_adjacent():
    ivs = [Interval(0, "c", "s1"), Interval(1, "c", "s2")]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 0, "c", "s1"), Chunk(1, 1, "c", "s2")]


def test_category_change_splits_even_when_adjacent():
    ivs = [Interval(0, "c1", "s"), Interval(1, "c2", "s")]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 0, "c1", "s"), Chunk(1, 1, "c2", "s")]


def test_unordered_input_is_sorted_before_grouping():
    ivs = [Interval(2, "c", "s"), Interval(0, "c", "s"), Interval(1, "c", "s")]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 2, "c", "s")]
    assert chunks[0].duration == 15


def test_none_category_intervals_group_together():
    ivs = [Interval(0), Interval(1), Interval(2)]
    chunks = group_intervals(ivs)
    assert chunks == [Chunk(0, 2, None, None)]
