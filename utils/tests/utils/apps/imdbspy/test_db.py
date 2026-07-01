"""Stage 8 verification: the managed IMDbSpy schema round-trips unchanged and the
default weights are seeded. Runs against a fresh, migrated throwaway DB.
"""

from __future__ import annotations

import pytest
from django.db.utils import IntegrityError

from utils.apps.imdbspy.backend.models import MediaItem, RatingWeights

WEIGHT_FIELDS = (
    "entertaining_weight",
    "momentum_weight",
    "characters_weight",
    "rewatchability_weight",
    "immersive_weight",
    "stakes_weight",
    "heart_weight",
)


def test_media_item_full_roundtrip():
    item = MediaItem.objects.create(
        imdb_id="rt0001",
        title="Round Trip",
        kind="tv series",
        genres=["Crime", "Drama"],
        rating=8.5,
        rating_count=1234,
        creators=[{"name": "Creator", "id": "1"}],
        seasons=3,
        seasons_seen=1,
        episodes=30,
        years="2020-2022",
        directors=[{"name": "Director", "id": "2"}],
        writers=[{"name": "Writer", "id": "3"}],
        runtime_minutes=50,
        cast=[{"name": "Actor", "id": "4"}],
        title_image_path="tv-movie/rt0001.webp",
        actor_image_paths={"Actor": "actors/4.webp"},
        status="seen",
        user_rating=7.5,
        user_review="good",
        scale_type="grit",
        immersive_rating=4,
        stakes_rating=3,
        characters_rating=5,
        rewatchability_rating=2,
    )

    back = MediaItem.objects.get(pk=item.pk)
    data = back.to_dict()

    # JSON columns preserve structure
    assert data["genres"] == ["Crime", "Drama"]
    assert data["cast"] == [{"name": "Actor", "id": "4"}]
    assert data["actor_image_paths"] == {"Actor": "actors/4.webp"}
    assert data["creators"][0]["name"] == "Creator"
    # scalars preserved
    assert data["rating"] == 8.5 and data["rating_count"] == 1234
    assert data["seasons"] == 3 and data["seasons_seen"] == 1
    assert data["scale_type"] == "grit" and data["immersive_rating"] == 4
    # datetime serialized as an ISO string; legacy is_seen column omitted
    assert isinstance(data["added_at"], str)
    assert "is_seen" not in data
    assert len(data) == 31


def test_imdb_id_is_unique():
    MediaItem.objects.create(imdb_id="dup0001", title="First", kind="movie")
    with pytest.raises(IntegrityError):
        MediaItem.objects.create(imdb_id="dup0001", title="Second", kind="movie")


def test_default_weights_seeded_and_quarter_valued():
    scales = {w.scale_type: w for w in RatingWeights.objects.all()}
    assert set(scales) == {"fun", "grit", "comfort"}
    for weights in scales.values():
        for field in WEIGHT_FIELDS:
            assert getattr(weights, field) == 0.25
