"""Stage 6 verification: IMDbSpy agent tools — structured output, service-layer
usage (injectable seam), and denial cases (missing-confirm delete, invalid input).
Runs against a fresh migrated DB (autouse fixture).
"""

from __future__ import annotations

from utils.apps.imdbspy.agent import tools
from utils.apps.imdbspy.backend.models import MediaItem
from utils.tests.utils.apps.imdbspy.fakes import FakeScraper, make_result


def _seed(**over) -> MediaItem:
    base = dict(imdb_id="0111161", title="Shawshank", kind="movie", status="not_seen")
    base.update(over)
    return MediaItem.objects.create(**base)


def test_list_media_structured_output():
    _seed()
    _seed(imdb_id="0068646", title="The Godfather")
    out = tools.list_media()
    assert set(out) == {"items", "total", "has_more"}
    assert out["total"] == 2


def test_add_media_uses_injected_scraper_no_network():
    scraper = FakeScraper(results=make_result(imdb_id="0068646", title="The Godfather"))
    out = tools.add_media(urls=["tt0068646"], scraper=scraper)
    assert len(out["added"]) == 1 and out["errors"] == []
    assert scraper.run_calls == ["tt0068646"]  # routed through the injected fake


def test_delete_requires_confirmation():
    item = _seed()
    denied = tools.delete_media(item_id=item.id)  # no confirm
    assert denied["error"]["code"] == "permission_denied"
    assert MediaItem.objects.filter(id=item.id).exists()  # nothing deleted

    ok = tools.delete_media(item_id=item.id, confirm=True)
    assert ok == {"deleted": True}
    assert not MediaItem.objects.filter(id=item.id).exists()


def test_set_status_invalid_returns_validation_error():
    item = _seed()
    out = tools.set_status(item_id=item.id, status="bogus")
    assert out["error"]["code"] == "validation_error"


def test_update_review_missing_item_returns_not_found():
    out = tools.update_review(
        item_id=999999, scale_type="fun", ratings={"entertaining_rating": 5}
    )
    assert out["error"]["code"] == "not_found"


def test_update_review_happy_path_returns_item():
    item = _seed()
    out = tools.update_review(
        item_id=item.id,
        scale_type="fun",
        ratings={
            "entertaining_rating": 5,
            "momentum_rating": 5,
            "characters_rating": 5,
            "rewatchability_rating": 5,
        },
    )
    assert out["item"]["user_rating"] == 10.0


def test_tools_call_service_layer_via_injectable_seam():
    """The tool must delegate to the service, not reimplement logic."""

    class FakeService:
        def __init__(self):
            self.calls: list[tuple] = []

        def list_media(self, **kwargs):
            self.calls.append(("list_media", kwargs))
            return {"items": [], "total": 0, "has_more": False}

    fake = FakeService()
    out = tools.list_media(service=fake, status="seen")
    assert fake.calls and fake.calls[0][0] == "list_media"
    assert fake.calls[0][1]["status"] == "seen"
    assert out == {"items": [], "total": 0, "has_more": False}
