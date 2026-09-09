"""IMDbSpy tools (6): list, add (scraper), status, review, refresh, delete."""

from __future__ import annotations

from utils.apps.imdbspy.shared.ratings import criteria_for
from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "imdbspy"]


def _titles(sb):
    from utils.apps.imdbspy.backend.models import MediaItem
    return set(MediaItem.objects.values_list("title", flat=True))


def _status(sb, title):
    from utils.apps.imdbspy.backend.models import MediaItem
    return MediaItem.objects.get(title=title).status


SCENARIOS = [
    h.Scenario(
        id="imdbspy.unseen_movies",
        title="Filter the watchlist",
        groups=G,
        prompt="Which movies in my tracker haven't I seen yet?",
        turns=[
            h.calls(h.call("imdbspy_list_media", "filter by status and kind instead of listing everything",
                           status="not_seen", kind="movie",
                           check=lambda r: _assert([i["title"] for i in r["items"]] == ["The Shawshank Redemption"]))),
            h.answer("Only The Shawshank Redemption is still unseen."),
        ],
        live=h.LiveExpectation(required=["imdbspy_list_media"], forbidden=["imdbspy_delete_media"],
                               answer_any=["shawshank"]),
    ),
    h.Scenario(
        id="imdbspy.add_title",
        title="Add a title by IMDb id (scraper faked)",
        groups=G,
        prompt="Add The Godfather (tt0068646) to my tracker.",
        turns=[
            h.calls(h.call("imdbspy_add_media", "add by IMDb id; the scraper fetches metadata", urls=["tt0068646"],
                           check=lambda r: _assert([a["title"] for a in r["added"]] == ["The Godfather"]))),
            h.answer("Added The Godfather (1972)."),
        ],
        live=h.LiveExpectation(required=["imdbspy_add_media"], answer_any=["godfather"]),
        verify=lambda sb: _assert("The Godfather" in _titles(sb)),
    ),
    h.Scenario(
        id="imdbspy.add_duplicate",
        title="Adding a tracked title reports a per-item conflict",
        groups=G,
        prompt="Add tt0111161 to my tracker.",
        notes="The tool succeeds as a whole but carries a per-item error with code conflict; nothing is duplicated.",
        setup=lambda sb: sb.scraper._results.update({
            "tt0111161": __import__("utils.tests.utils.apps.imdbspy.fakes", fromlist=["x"]).make_result(),
            "0111161": __import__("utils.tests.utils.apps.imdbspy.fakes", fromlist=["x"]).make_result(),
        }),
        turns=[
            h.calls(h.call("imdbspy_add_media", "try the add", urls=["tt0111161"],
                           check=lambda r: _assert(r["added"] == [] and r["errors"] and r["errors"][0]["code"] == "conflict",
                                                   f"expected a conflict, got {r}"))),
            h.answer("That title is already tracked."),
        ],
        live=h.LiveExpectation(required=["imdbspy_add_media"], answer_any=["already"]),
    ),
    h.Scenario(
        id="imdbspy.watched_and_rated",
        title="Mark seen, then rate on the fun scale",
        groups=G,
        prompt=("I watched The Shawshank Redemption last night. Mark it seen and rate it on the fun "
                "scale: 5 for everything except rewatchability, which is 4."),
        notes="Two writes that depend on an id from a read; ratings are per-criterion and the 0-10 score is computed.",
        turns=[
            h.calls(h.call("imdbspy_list_media", "resolve the integer id by title", search="shawshank")),
            h.calls(
                h.dynamic("imdbspy_set_status", "status is a separate write from the review",
                          lambda ctx: {"item_id": find(ctx.result("imdbspy_list_media")["items"],
                                                        title="The Shawshank Redemption")["id"],
                                       "status": "seen"}),
                h.dynamic("imdbspy_update_review", "fun scale criteria come from the guidance",
                          lambda ctx: {"item_id": find(ctx.result("imdbspy_list_media")["items"],
                                                        title="The Shawshank Redemption")["id"],
                                       "scale_type": "fun",
                                       "ratings": {f"{c}_rating": (4 if c == "rewatchability" else 5)
                                                   for c in criteria_for("fun")}},
                          check=lambda r: _assert(r["item"]["user_rating"] is not None and r["item"]["status"] == "seen")),
            ),
            h.answer("Marked seen and rated it 9.5/10 on the fun scale."),
        ],
        live=h.LiveExpectation(required=["imdbspy_list_media", "imdbspy_set_status", "imdbspy_update_review"],
                               order=[("imdbspy_list_media", "imdbspy_set_status"),
                                      ("imdbspy_list_media", "imdbspy_update_review")]),
        verify=lambda sb: _assert(_status(sb, "The Shawshank Redemption") == "seen"),
    ),
    h.Scenario(
        id="imdbspy.season_progress",
        title="Record TV progress",
        groups=G,
        prompt="I just finished season 2 of Severance.",
        turns=[
            h.calls(h.call("imdbspy_list_media", "find the show", search="severance", kind="tv")),
            h.calls(h.dynamic("imdbspy_update_review", "seasons_seen is part of the review payload",
                              lambda ctx: {"item_id": ctx.result("imdbspy_list_media")["items"][0]["id"],
                                           "seasons_seen": 2},
                              check=lambda r: _assert(r["item"]["seasons_seen"] == 2))),
            h.answer("Severance is now at 2 seasons seen."),
        ],
        live=h.LiveExpectation(required=["imdbspy_list_media", "imdbspy_update_review"],
                               order=[("imdbspy_list_media", "imdbspy_update_review")]),
    ),
    h.Scenario(
        id="imdbspy.refresh",
        title="Refresh metadata for everything",
        groups=G,
        prompt="Refresh the IMDb ratings for all my tracked titles.",
        turns=[
            h.calls(h.call("imdbspy_refresh_metadata", "one call refreshes every title",
                           check=lambda r: _assert(isinstance(r, dict) and r))),
            h.answer("Refreshed the metadata for all tracked titles."),
        ],
        live=h.LiveExpectation(required=["imdbspy_refresh_metadata"], max_calls=4),
    ),
    h.Scenario(
        id="imdbspy.delete_requires_confirm",
        title="Delete without approval is refused",
        groups=G,
        prompt="Remove Severance from my tracker.",
        turns=[
            h.calls(h.call("imdbspy_list_media", "find the id", search="severance")),
            h.calls(h.dynamic("imdbspy_delete_media", "not approved -> no confirm",
                              lambda ctx: {"item_id": ctx.result("imdbspy_list_media")["items"][0]["id"]},
                              expect=h.DENIED_CONFIRM)),
            h.answer("Removing Severance is permanent. Confirm?"),
        ],
        live=h.LiveExpectation(answer_any=["confirm", "sure", "permanent", "go ahead", "remove", "delete"]),
        verify=lambda sb: _assert("Severance" in _titles(sb), "Severance was deleted without approval"),
    ),
    h.Scenario(
        id="imdbspy.delete_after_approval",
        title="Delete after approval",
        groups=G,
        history=approved("Remove Severance from my tracker.", "That is permanent. Remove it?"),
        prompt="Yes, remove it.",
        turns=[
            h.calls(h.call("imdbspy_list_media", "find the id", search="severance")),
            h.calls(h.dynamic("imdbspy_delete_media", "approved -> confirm: true",
                              lambda ctx: {"item_id": ctx.result("imdbspy_list_media")["items"][0]["id"],
                                           "confirm": True})),
            h.answer("Removed Severance."),
        ],
        live=h.LiveExpectation(required=["imdbspy_delete_media"]),
        verify=lambda sb: _assert("Severance" not in _titles(sb), "Severance still exists"),
    ),
    h.Scenario(
        id="imdbspy.typed_errors",
        title="Bad status and unknown id are typed errors",
        groups=G,
        prompt="Mark item 424242 as 'watching'.",
        turns=[
            h.calls(h.call("imdbspy_set_status", "invalid status value", item_id=424242, status="watching",
                           expect=h.error("validation_error"))),
            h.calls(h.call("imdbspy_set_status", "valid status, unknown id", item_id=424242, status="seen",
                           expect=h.error("not_found"))),
            h.answer("'watching' is not a valid status, and there is no item 424242."),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
