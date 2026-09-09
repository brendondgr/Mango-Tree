"""Media viewer tools (4): list, get, save, delete artifacts."""

from __future__ import annotations

import base64

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved, find

G = ["core", "media_viewer"]


def _filenames(sb):
    from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore
    return [a.filename for a in ArtifactStore().list()]


SCENARIOS = [
    h.Scenario(
        id="media_viewer.list_and_inspect",
        title="List saved files, then fetch one's metadata",
        groups=G,
        prompt="What files have I saved? Give me the details of the notes file.",
        turns=[
            h.calls(h.call("media_viewer_list_artifacts", "persisted artifacts, all kinds",
                           check=lambda r: _assert(len(r["artifacts"]) == 2))),
            h.calls(h.dynamic("media_viewer_get_artifact", "metadata by the id the list returned",
                              lambda ctx: {"artifact_id": find(ctx.result("media_viewer_list_artifacts")["artifacts"],
                                                               filename="scenario-notes.md")["id"]},
                              check=lambda r: _assert(r["artifact"]["mime_type"] == "text/markdown"))),
            h.answer("Two files: scenario-notes.md (markdown) and scenario-swatch.png (image)."),
        ],
        live=h.LiveExpectation(required=["media_viewer_list_artifacts"], forbidden=["media_viewer_delete_artifact"],
                               answer_any=["notes"]),
    ),
    h.Scenario(
        id="media_viewer.only_images",
        title="Filter by kind",
        groups=G,
        prompt="Show me only my saved images.",
        turns=[
            h.calls(h.call("media_viewer_list_artifacts", "kind filter narrows the list", kind="image",
                           check=lambda r: _assert([a["filename"] for a in r["artifacts"]] == ["scenario-swatch.png"]))),
            h.answer("One image: scenario-swatch.png."),
        ],
        live=h.LiveExpectation(required=["media_viewer_list_artifacts"], answer_any=["swatch"]),
    ),
    h.Scenario(
        id="media_viewer.save_text",
        title="Save generated text as an artifact",
        groups=G,
        prompt="Save a file called scenario-shopping.txt containing 'milk, eggs, bread'.",
        turns=[
            h.calls(h.call("media_viewer_save_artifact", "bytes are base64 on the wire",
                           filename="scenario-shopping.txt",
                           content_base64=base64.b64encode(b"milk, eggs, bread").decode(),
                           mime_type="text/plain",
                           check=lambda r: _assert(r["artifact_id"] and r["artifact"]["filename"] == "scenario-shopping.txt"))),
            h.answer("Saved scenario-shopping.txt."),
        ],
        live=h.LiveExpectation(required=["media_viewer_save_artifact"]),
        verify=lambda sb: _assert("scenario-shopping.txt" in _filenames(sb)),
    ),
    h.Scenario(
        id="media_viewer.save_invalid",
        title="Bad base64 and empty content are validation errors",
        groups=G,
        prompt="Save x.bin with content '@@@'.",
        turns=[
            h.calls(
                h.call("media_viewer_save_artifact", "not base64", filename="x.bin", content_base64="@@@",
                       expect=h.error("validation_error")),
                h.call("media_viewer_save_artifact", "no content", filename="y.bin",
                       expect=h.error("validation_error")),
            ),
            h.answer("The content must be base64-encoded and non-empty."),
        ],
    ),
    h.Scenario(
        id="media_viewer.delete_requires_confirm",
        title="Delete without approval is refused",
        groups=G,
        prompt="Delete the swatch image.",
        turns=[
            h.calls(h.call("media_viewer_list_artifacts", "find the id", kind="image")),
            h.calls(h.dynamic("media_viewer_delete_artifact", "no approval -> no confirm",
                              lambda ctx: {"artifact_id": ctx.result("media_viewer_list_artifacts")["artifacts"][0]["id"]},
                              expect=h.DENIED_CONFIRM)),
            h.answer("Deleting scenario-swatch.png is permanent. Confirm?"),
        ],
        live=h.LiveExpectation(answer_any=["confirm", "sure", "permanent", "go ahead", "delete"]),
        verify=lambda sb: _assert("scenario-swatch.png" in _filenames(sb), "deleted without approval"),
    ),
    h.Scenario(
        id="media_viewer.delete_after_approval",
        title="Delete after approval, then the id is gone",
        groups=G,
        history=approved("Delete the swatch image.", "That is permanent. Delete scenario-swatch.png?"),
        prompt="Yes.",
        turns=[
            h.calls(h.call("media_viewer_list_artifacts", "find the id", kind="image")),
            h.calls(h.dynamic("media_viewer_delete_artifact", "approved -> confirm: true",
                              lambda ctx: {"artifact_id": ctx.result("media_viewer_list_artifacts")["artifacts"][0]["id"],
                                           "confirm": True})),
            h.calls(h.dynamic("media_viewer_get_artifact", "a re-read of the deleted id is a typed not_found",
                              lambda ctx: {"artifact_id": ctx.result("media_viewer_list_artifacts")["artifacts"][0]["id"]},
                              expect=h.error("not_found"))),
            h.answer("Deleted scenario-swatch.png."),
        ],
        live=h.LiveExpectation(required=["media_viewer_delete_artifact"]),
        verify=lambda sb: _assert("scenario-swatch.png" not in _filenames(sb)),
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
