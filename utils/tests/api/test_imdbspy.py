"""Stage 5 verification: the DRF API over the IMDbSpy services, including stable
error codes and the sanitized asset endpoint. Runs against a fresh migrated DB.
"""

from __future__ import annotations

import json

from django.test import Client

from utils.apps.imdbspy.backend.models import MediaItem
from utils.tests.utils.apps.imdbspy.fakes import FakeScraper, make_result


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _put(client, url, payload):
    return client.put(url, data=json.dumps(payload), content_type="application/json")


def _create(**over) -> MediaItem:
    base = dict(imdb_id="0111161", title="Shawshank", kind="movie", status="not_seen")
    base.update(over)
    return MediaItem.objects.create(**base)


# --- list / add ---------------------------------------------------------------

def test_list_media_empty_envelope(imdbspy_db):
    res = Client().get("/api/imdbspy/media/")
    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0, "has_more": False}


def test_add_media_endpoint(imdbspy_db, monkeypatch):
    monkeypatch.setattr(
        "utils.apps.imdbspy.backend.services.media_items._default_scraper",
        lambda: FakeScraper(results=make_result(imdb_id="0068646", title="The Godfather")),
    )
    res = _post(Client(), "/api/imdbspy/media/add/", {"urls": ["tt0068646"]})
    assert res.status_code == 200
    body = res.json()
    assert len(body["added"]) == 1 and body["errors"] == []
    assert Client().get("/api/imdbspy/media/").json()["total"] == 1


def test_add_media_no_urls_is_400(imdbspy_db):
    res = _post(Client(), "/api/imdbspy/media/add/", {})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


# --- status -------------------------------------------------------------------

def test_set_status_and_invalid(imdbspy_db):
    item = _create()
    ok = _post(Client(), f"/api/imdbspy/media/{item.id}/status/", {"status": "seen"})
    assert ok.status_code == 200 and ok.json()["status"] == "seen"

    bad = _post(Client(), f"/api/imdbspy/media/{item.id}/status/", {"status": "bogus"})
    assert bad.status_code == 400 and bad.json()["code"] == "validation_error"


def test_status_missing_item_is_404(imdbspy_db):
    res = _post(Client(), "/api/imdbspy/media/999999/status/", {"status": "seen"})
    assert res.status_code == 404 and res.json()["code"] == "not_found"


# --- review / seasons ---------------------------------------------------------

def test_review_weighted_score(imdbspy_db):
    item = _create()
    res = _put(
        Client(),
        f"/api/imdbspy/media/{item.id}/review/",
        {
            "scale_type": "fun",
            "entertaining_rating": 5,
            "momentum_rating": 5,
            "characters_rating": 5,
            "rewatchability_rating": 5,
            "user_review": "Perfect.",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user_rating"] == 10.0 and body["user_review"] == "Perfect."


def test_seasons_on_movie_is_400(imdbspy_db):
    item = _create(kind="movie")
    res = _put(Client(), f"/api/imdbspy/media/{item.id}/seasons/", {"seasons_seen": 2})
    assert res.status_code == 400 and res.json()["code"] == "validation_error"


# --- delete -------------------------------------------------------------------

def test_delete_then_404(imdbspy_db):
    item = _create()
    res = Client().delete(f"/api/imdbspy/media/{item.id}/")
    assert res.status_code == 204
    again = Client().delete(f"/api/imdbspy/media/{item.id}/")
    assert again.status_code == 404


# --- weights ------------------------------------------------------------------

def test_weights_get_and_put(imdbspy_db):
    res = Client().get("/api/imdbspy/weights/")
    assert res.status_code == 200 and len(res.json()) == 3

    put = _put(
        Client(),
        "/api/imdbspy/weights/",
        [{"scale_type": "fun", "entertaining_weight": 0.4, "momentum_weight": 0.2,
          "characters_weight": 0.2, "rewatchability_weight": 0.2}],
    )
    assert put.status_code == 200
    assert put.json()[0]["entertaining_weight"] == 0.4


# --- assets -------------------------------------------------------------------

def test_asset_serves_file(imdbspy_db, tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(tmp_path))
    (tmp_path / "tv-movie").mkdir()
    (tmp_path / "tv-movie" / "0111161.webp").write_bytes(b"IMG")
    res = Client().get("/api/imdbspy/assets/tv-movie/0111161.webp")
    assert res.status_code == 200
    assert b"".join(res.streaming_content) == b"IMG"


def test_asset_missing_is_404(imdbspy_db, tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(tmp_path))
    res = Client().get("/api/imdbspy/assets/tv-movie/missing.webp")
    assert res.status_code == 404 and res.json()["code"] == "not_found"
