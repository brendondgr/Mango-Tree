"""Stage 5 verification: the DRF API over the recipes services, including stable
error codes, pagination, pantry match, image upload, and denial cases. Runs
against a fresh seeded throwaway DB."""

from __future__ import annotations

import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _patch(client, url, payload):
    return client.patch(url, data=json.dumps(payload), content_type="application/json")


def _ingredient_ids(client, *names) -> list[int]:
    grouped = client.get("/api/recipes/ingredients/").json()
    lookup = {item["name"]: item["id"] for items in grouped.values() for item in items}
    return [lookup[n] for n in names]


def _new_recipe(**overrides) -> dict:
    payload = {
        "title": "API Omelette",
        "servings": 1,
        "cuisine_region": "French",
        "meal_type": "Breakfast",
        "ingredients": [{"name": "Eggs", "quantity": 3, "unit": "large"}],
        "steps": ["Beat eggs.", "Cook."],
    }
    payload.update(overrides)
    return payload


# --- recipes ------------------------------------------------------------------


def test_list_envelope(recipes_db):
    res = Client().get("/api/recipes/recipes/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 5


def test_create_then_list(recipes_db):
    client = Client()
    res = _post(client, "/api/recipes/recipes/", _new_recipe())
    assert res.status_code == 201
    assert res.json()["title"] == "API Omelette"
    assert client.get("/api/recipes/recipes/").json()["count"] == 6


def test_create_validation_error(recipes_db):
    res = _post(Client(), "/api/recipes/recipes/", _new_recipe(title=""))
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_detail_ok(recipes_db):
    listed = Client().get("/api/recipes/recipes/").json()["results"]
    recipe_id = next(r["id"] for r in listed if r["title"].startswith("Classic"))
    body = Client().get(f"/api/recipes/recipes/{recipe_id}/").json()
    assert body["servings"] == 4
    assert len(body["steps"]) == 7
    assert any(i["name"] == "pasta" for i in body["ingredients"])


def test_detail_not_found(recipes_db):
    res = Client().get("/api/recipes/recipes/999999/")
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"


def test_patch_update(recipes_db):
    client = Client()
    recipe_id = _post(client, "/api/recipes/recipes/", _new_recipe()).json()["id"]
    res = _patch(client, f"/api/recipes/recipes/{recipe_id}/", _new_recipe(title="Renamed"))
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed"


def test_delete_then_gone(recipes_db):
    client = Client()
    recipe_id = _post(client, "/api/recipes/recipes/", _new_recipe()).json()["id"]
    assert client.delete(f"/api/recipes/recipes/{recipe_id}/").status_code == 204
    assert client.get(f"/api/recipes/recipes/{recipe_id}/").status_code == 404


# --- filter / pantry match ----------------------------------------------------


def test_filter_by_pantry_ranks_match(recipes_db):
    client = Client()
    pantry = _ingredient_ids(
        client, "lettuce", "tomato", "carrot", "avocado", "olive oil", "lemon", "salt"
    )
    res = _post(client, "/api/recipes/recipes/filter/", {"ingredient_ids": pantry})
    results = res.json()["results"]
    assert results[0]["title"] == "Fresh Garden Salad"
    assert results[0]["match_percentage"] == 100.0


def test_filter_by_meal_type(recipes_db):
    res = _post(Client(), "/api/recipes/recipes/filter/", {"meal_types": ["Lunch"]})
    titles = {r["title"] for r in res.json()["results"]}
    assert titles == {"Fresh Garden Salad", "Creamy Tomato Basil Soup"}


# --- ingredients + filter options ---------------------------------------------


def test_ingredients_grouped(recipes_db):
    body = Client().get("/api/recipes/ingredients/").json()
    assert "Produce" in body
    assert any(i["name"] == "garlic" for i in body["Produce"])


def test_ingredient_search(recipes_db):
    body = Client().get("/api/recipes/ingredients/search/?q=gar").json()
    assert body[0]["name"] == "garlic"


def test_filter_options(recipes_db):
    body = Client().get("/api/recipes/filter-options/").json()
    meals = {row["value"] for row in body["meal_types"]}
    assert {"Dinner", "Lunch"} <= meals


# --- images (API-only) --------------------------------------------------------


def test_image_upload_and_serve(recipes_db):
    client = Client()
    upload = SimpleUploadedFile("pic.png", b"pngbytes", content_type="image/png")
    res = client.post("/api/recipes/images/", {"image": upload})
    assert res.status_code == 201
    url = res.json()["url"]
    assert url.startswith("/api/recipes/images/")
    served = client.get(url)
    assert served.status_code == 200


def test_image_upload_bad_extension(recipes_db):
    client = Client()
    upload = SimpleUploadedFile("evil.exe", b"x", content_type="application/octet-stream")
    res = client.post("/api/recipes/images/", {"image": upload})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


# --- parser denial (no network; empty text short-circuits before the LLM) -----


def test_parse_empty_text_is_validation_error(recipes_db):
    res = _post(Client(), "/api/recipes/parse/", {"text": ""})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"
