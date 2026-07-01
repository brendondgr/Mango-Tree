"""API verification: the DRF layer over the timekeeper services, including stable
error codes and pagination. Runs against a throwaway DB copy (timekeeper_db)."""

from __future__ import annotations

import json

from django.test import Client


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _put(client, url, payload):
    return client.put(url, data=json.dumps(payload), content_type="application/json")


# --- logs list ----------------------------------------------------------------

def test_list_logs_envelope(timekeeper_db):
    res = Client().get("/api/timekeeper/logs/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] > 0
    first = body["results"][0]
    assert {"id", "date", "start_time", "duration", "category_id"} <= set(first)


def test_list_logs_by_date(timekeeper_db):
    all_logs = Client().get("/api/timekeeper/logs/?page_size=2000").json()["results"]
    a_date = all_logs[0]["date"]
    res = Client().get(f"/api/timekeeper/logs/?date={a_date}")
    assert res.status_code == 200
    assert all(r["date"] == a_date for r in res.json()["results"])


def test_list_logs_bad_date_returns_400(timekeeper_db):
    res = Client().get("/api/timekeeper/logs/?date=nope")
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


# --- save day (POST) ----------------------------------------------------------

def test_save_day_round_trip(timekeeper_db):
    client = Client()
    payload = {
        "date": "2019-12-31",
        "intervals": [
            {"index": 0, "category_id": "c", "subcategory_id": "s"},
            {"index": 1, "category_id": "c", "subcategory_id": "s"},
            {"index": 4, "category_id": "c", "subcategory_id": "s"},
        ],
    }
    res = _post(client, "/api/timekeeper/logs/", payload)
    assert res.status_code == 200
    logs = res.json()["logs"]
    assert len(logs) == 2  # 0-1 merged, 4 separate
    assert logs[0]["duration"] == 10
    # reads back
    day = client.get("/api/timekeeper/logs/?date=2019-12-31").json()
    assert day["count"] == 2


def test_save_day_missing_date_returns_400(timekeeper_db):
    res = _post(Client(), "/api/timekeeper/logs/", {"intervals": []})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_save_day_bad_index_returns_400(timekeeper_db):
    res = _post(Client(), "/api/timekeeper/logs/", {"date": "2019-12-30", "intervals": [{"index": 5000}]})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


# --- update / delete ----------------------------------------------------------

def test_put_and_delete_log(timekeeper_db):
    client = Client()
    _post(client, "/api/timekeeper/logs/", {"date": "2019-12-29", "intervals": [{"index": 0}]})
    log_id = client.get("/api/timekeeper/logs/?date=2019-12-29").json()["results"][0]["id"]

    res = _put(client, f"/api/timekeeper/logs/{log_id}/", {"notes": "note", "duration": 15})
    assert res.status_code == 200
    assert res.json()["notes"] == "note"
    assert res.json()["duration"] == 15

    res = client.delete(f"/api/timekeeper/logs/{log_id}/")
    assert res.status_code == 204
    assert client.get("/api/timekeeper/logs/?date=2019-12-29").json()["count"] == 0


def test_delete_unknown_log_returns_404(timekeeper_db):
    res = Client().delete("/api/timekeeper/logs/999999/")
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"


def test_put_unknown_log_returns_404(timekeeper_db):
    res = _put(Client(), "/api/timekeeper/logs/999999/", {"notes": "x"})
    assert res.status_code == 404


# --- stats --------------------------------------------------------------------

def test_daily_stats(timekeeper_db):
    res = Client().get("/api/timekeeper/stats/daily/")
    assert res.status_code == 200
    days = res.json()["days"]
    assert days and {"date", "total_duration"} <= set(days[0])


# --- categories ---------------------------------------------------------------

def test_get_categories(timekeeper_db):
    res = Client().get("/api/timekeeper/categories/")
    assert res.status_code == 200
    cats = res.json()["categories"]
    assert isinstance(cats, list) and cats


def test_put_categories_replaces(timekeeper_db):
    client = Client()
    payload = {
        "categories": [
            {"id": "cat_a", "name": "A", "colorId": "green", "subcategories": []}
        ]
    }
    res = _put(client, "/api/timekeeper/categories/", payload)
    assert res.status_code == 200
    assert res.json()["categories"][0]["id"] == "cat_a"
    assert client.get("/api/timekeeper/categories/").json()["categories"] == payload["categories"]


def test_put_categories_bad_shape_returns_400(timekeeper_db):
    res = _put(Client(), "/api/timekeeper/categories/", {"categories": [{"name": "no id"}]})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"
