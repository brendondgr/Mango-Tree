"""Stage 4 verification: ported IMDbSpy domain services, including validation
and denial cases. Runs against a fresh, migrated throwaway DB (autouse fixture).
"""

from __future__ import annotations

import pytest

from utils.apps.imdbspy.backend.models import MediaItem, RatingWeights
from utils.apps.imdbspy.backend.services import media, media_items, weights
from utils.apps.imdbspy.shared.errors import NotFoundError, ValidationError
from utils.tests.utils.apps.imdbspy.fakes import FakeScraper, make_result


# --- seed / list --------------------------------------------------------------

def test_default_weights_seeded():
    scales = sorted(w.scale_type for w in weights.get_weights())
    assert scales == ["comfort", "fun", "grit"]


def test_list_media_empty_baseline():
    result = media_items.list_media()
    assert result == {"items": [], "total": 0, "has_more": False}


def test_add_then_list_and_filter_and_search():
    scraper = FakeScraper(
        results={
            "movie": make_result(imdb_id="0111161", title="Shawshank", kind="movie"),
            "show": make_result(
                imdb_id="0903747",
                title="Breaking Bad",
                kind="tv series",
                genres=["Crime", "Drama"],
                cast=[{"name": "Bryan Cranston", "id": "0186505"}],
            ),
        }
    )
    media_items.add_media(["movie", "show"], scraper=scraper)

    assert media_items.list_media()["total"] == 2
    assert media_items.list_media(kind="movie")["total"] == 1
    assert media_items.list_media(kind="tv")["total"] == 1

    # search spans title, genres, and cast names
    assert media_items.list_media(search="Cranston")["total"] == 1
    assert media_items.list_media(search="crime")["total"] == 1
    assert media_items.list_media(search="nonexistent")["total"] == 0

    # pagination envelope
    page = media_items.list_media(limit=1, offset=0)
    assert len(page["items"]) == 1 and page["has_more"] is True


# --- add: denial paths --------------------------------------------------------

def test_add_media_duplicate_is_conflict():
    scraper = FakeScraper(results=make_result(imdb_id="0068646", title="The Godfather"))
    first = media_items.add_media("any", scraper=scraper)
    assert len(first["added"]) == 1 and first["errors"] == []

    second = media_items.add_media("any", scraper=scraper)
    assert second["added"] == []
    assert second["errors"][0]["code"] == "conflict"
    assert MediaItem.objects.count() == 1


def test_add_media_episode_rejected():
    scraper = FakeScraper(results=make_result(imdb_id="1234567", kind="episode"))
    result = media_items.add_media("any", scraper=scraper)
    assert result["added"] == []
    assert result["errors"][0]["code"] == "validation_error"
    assert "episode" in result["errors"][0]["message"].lower()


def test_add_media_no_urls_raises():
    with pytest.raises(ValidationError):
        media_items.add_media([], scraper=FakeScraper())


# --- status -------------------------------------------------------------------

def _add_one(**over) -> MediaItem:
    scraper = FakeScraper(results=make_result(**over))
    media_items.add_media("any", scraper=scraper)
    return MediaItem.objects.get(imdb_id=over.get("imdb_id", "0111161"))


def test_set_status_valid_and_invalid():
    item = _add_one()
    updated = media_items.set_status(item.id, "seen")
    assert updated.status == "seen"

    with pytest.raises(ValidationError):
        media_items.set_status(item.id, "bogus")


def test_set_status_missing_item_not_found():
    with pytest.raises(NotFoundError):
        media_items.set_status(999999, "seen")


# --- weighted review ----------------------------------------------------------

def test_update_review_weighted_score_all_fives():
    item = _add_one()
    updated = media_items.update_review(
        item.id,
        scale_type="fun",
        ratings={
            "entertaining_rating": 5,
            "momentum_rating": 5,
            "characters_rating": 5,
            "rewatchability_rating": 5,
        },
    )
    # 5 * 0.25 * 4 = 5.0 -> doubled to a 0-10 scale
    assert updated.user_rating == 10.0
    assert updated.scale_type == "fun"


def test_update_review_weighted_score_partial_and_clamped():
    item = _add_one()
    updated = media_items.update_review(
        item.id,
        scale_type="fun",
        ratings={"entertaining_rating": 5, "momentum_rating": 99},  # 99 clamps to 5
    )
    # entertaining(5)*.25 + momentum(5)*.25 + chars(0) + rewatch(0) = 2.5 -> 5.0
    assert updated.user_rating == 5.0


def test_update_review_invalid_scale_rejected():
    item = _add_one()
    with pytest.raises(ValidationError):
        media_items.update_review(item.id, scale_type="nope")


def test_update_review_seasons_ignored_for_movie():
    item = _add_one(kind="movie")
    updated = media_items.update_review(item.id, seasons_seen=3)
    assert updated.seasons_seen is None  # movies ignore seasons here


# --- seasons ------------------------------------------------------------------

def test_update_seasons_seen_movie_rejected():
    item = _add_one(kind="movie")
    with pytest.raises(ValidationError):
        media_items.update_seasons_seen(item.id, 1)


def test_update_seasons_seen_exceeds_total_rejected():
    item = _add_one(imdb_id="0903747", kind="tv series", seasons=5)
    with pytest.raises(ValidationError):
        media_items.update_seasons_seen(item.id, 6)
    ok = media_items.update_seasons_seen(item.id, 3)
    assert ok.seasons_seen == 3


# --- delete -------------------------------------------------------------------

def test_delete_media_and_missing():
    item = _add_one()
    media_items.delete_media(item.id)
    assert MediaItem.objects.count() == 0
    with pytest.raises(NotFoundError):
        media_items.delete_media(item.id)


# --- weights update + recalc --------------------------------------------------

def test_update_weights_recalculates_affected_items():
    item = _add_one()
    media_items.update_review(
        item.id,
        scale_type="fun",
        ratings={"entertaining_rating": 5, "momentum_rating": 0,
                 "characters_rating": 0, "rewatchability_rating": 0},
    )
    item.refresh_from_db()
    assert item.user_rating == 2.5  # 5 * 0.25 * 2

    # shift all of "fun" onto the entertaining criterion
    weights.update_weights([
        {
            "scale_type": "fun",
            "entertaining_weight": 1.0,
            "momentum_weight": 0.0,
            "characters_weight": 0.0,
            "rewatchability_weight": 0.0,
        }
    ])
    item.refresh_from_db()
    assert item.user_rating == 10.0  # 5 * 1.0 * 2

    fun = RatingWeights.objects.get(scale_type="fun")
    assert fun.entertaining_weight == 1.0


def test_update_weights_rejects_non_list():
    with pytest.raises(ValidationError):
        weights.update_weights({"scale_type": "fun"})


# --- refresh ------------------------------------------------------------------

def test_refresh_all_updates_metadata():
    item = _add_one(imdb_id="0903747", kind="tv series", seasons=1, episodes=7)
    scraper = FakeScraper(refresh={"0903747": {"rating": 9.5, "seasons": 5, "episodes": 62}})
    result = media_items.refresh_all(scraper=scraper)
    assert result["updated_count"] == 1
    item.refresh_from_db()
    assert item.rating == 9.5 and item.seasons == 5 and item.episodes == 62


# --- media asset resolution (filesystem boundary) -----------------------------

def test_resolve_asset_serves_file_inside_root(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(tmp_path))
    (tmp_path / "tv-movie").mkdir()
    poster = tmp_path / "tv-movie" / "0111161.webp"
    poster.write_bytes(b"webpdata")
    assert media.resolve_asset("tv-movie/0111161.webp") == poster.resolve()


def test_resolve_asset_denies_traversal(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(tmp_path))
    for bad in ["../secrets.json", "../../etc/passwd", "/etc/passwd", "tv-movie/../../x"]:
        with pytest.raises(ValidationError):
            media.resolve_asset(bad)


def test_resolve_asset_missing_file_not_found(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(tmp_path))
    with pytest.raises(NotFoundError):
        media.resolve_asset("actors/does-not-exist.webp")
