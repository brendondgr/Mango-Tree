"""The /api/llm/ provider surface: refusal, key handling, and error shape.

This suite runs with real permission enforcement (see the exemption in
utils/tests/conftest.py). Two properties matter more than the happy path:

- an anonymous caller can neither enumerate providers nor make the server
  perform an outbound request on their behalf;
- an API key goes in and never comes back out.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from django.test import Client

from utils.shared.llm.models import LlmProvider
from utils.shared.llm.services import providers as providers_service
from utils.shared.llm.services import registry

ENDPOINTS = [
    ("get", "/api/llm/kinds/"),
    ("get", "/api/llm/providers/"),
    ("get", "/api/llm/models/"),
    ("post", "/api/llm/test/"),
    ("post", "/api/llm/providers/"),
    ("patch", "/api/llm/providers/some-slug/"),
    ("delete", "/api/llm/providers/some-slug/"),
]


@pytest.fixture
def owner(db):
    user = User.objects.create_user("owner", password="pw-for-tests-only")
    return user


@pytest.fixture
def client_as_owner(owner):
    client = Client()
    client.force_login(owner)
    return client


# --------------------------------------------------------------------- denial

@pytest.mark.django_db
@pytest.mark.parametrize("method,url", ENDPOINTS)
def test_anonymous_is_refused(method, url):
    response = getattr(Client(), method)(url, data={}, content_type="application/json")
    assert response.status_code == 403, f"{method.upper()} {url} was not refused"


@pytest.mark.django_db
def test_anonymous_cannot_trigger_an_outbound_request(monkeypatch):
    """The test endpoint makes the server call a third party. That must not be
    reachable without a session, or the login page becomes a proxy."""
    called = False

    def _spy(*args, **kwargs):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(providers_service, "test_provider", _spy)
    Client().post(
        "/api/llm/test/", data={"provider": "local"}, content_type="application/json"
    )
    assert called is False


# ----------------------------------------------------------------- key safety

@pytest.mark.django_db
def test_api_key_is_never_returned(client_as_owner):
    secret = "sk-test-DO-NOT-LEAK-abcd1234"
    created = client_as_owner.post(
        "/api/llm/providers/",
        data={
            "slug": "my-anthropic",
            "label": "My Anthropic",
            "kind": "anthropic",
            "api_key": secret,
        },
        content_type="application/json",
    )
    assert created.status_code == 201, created.content
    assert secret not in created.content.decode()

    listed = client_as_owner.get("/api/llm/providers/")
    assert secret not in listed.content.decode()

    # It was stored, though — the round-trip must not be silently dropping it.
    assert LlmProvider.objects.get(slug="my-anthropic").api_key == secret


@pytest.mark.django_db
def test_key_hint_identifies_without_revealing(client_as_owner):
    client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "hinted", "kind": "openai", "api_key": "sk-abcdefgh9999"},
        content_type="application/json",
    )
    entry = next(
        e for e in registry.list_providers() if e.slug == "hinted"
    )
    assert entry.key_hint == "…9999"
    assert "abcdefgh" not in entry.key_hint
    assert entry.has_key is True


@pytest.mark.django_db
def test_updating_another_field_does_not_wipe_the_key(client_as_owner):
    """A key is write-only, so an omitted field must leave it alone. Otherwise
    renaming a provider silently unauthenticates it."""
    client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "keeps-key", "kind": "openai", "api_key": "sk-keepme-1234"},
        content_type="application/json",
    )
    client_as_owner.patch(
        "/api/llm/providers/keeps-key/",
        data={"label": "Renamed"},
        content_type="application/json",
    )
    row = LlmProvider.objects.get(slug="keeps-key")
    assert row.label == "Renamed"
    assert row.api_key == "sk-keepme-1234"


@pytest.mark.django_db
def test_an_explicit_empty_key_clears_it(client_as_owner):
    client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "clears", "kind": "openai", "api_key": "sk-gone-1234"},
        content_type="application/json",
    )
    client_as_owner.patch(
        "/api/llm/providers/clears/",
        data={"api_key": ""},
        content_type="application/json",
    )
    assert LlmProvider.objects.get(slug="clears").api_key == ""


# ------------------------------------------------------------------ validation

@pytest.mark.django_db
def test_unknown_kind_is_rejected(client_as_owner):
    response = client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "bogus", "kind": "not-a-real-backend"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["field"] == "kind"


@pytest.mark.django_db
def test_local_kind_requires_a_base_url(client_as_owner):
    response = client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "no-url", "kind": "ollama"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["field"] == "base_url"


@pytest.mark.django_db
def test_hosted_kind_does_not_require_a_base_url(client_as_owner):
    response = client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "hosted-ok", "kind": "anthropic"},
        content_type="application/json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_duplicate_slug_conflicts(client_as_owner):
    payload = {"slug": "dupe", "kind": "openai"}
    assert client_as_owner.post(
        "/api/llm/providers/", data=payload, content_type="application/json"
    ).status_code == 201
    second = client_as_owner.post(
        "/api/llm/providers/", data=payload, content_type="application/json"
    )
    assert second.status_code == 409


@pytest.mark.django_db
@pytest.mark.parametrize("slug", ["Has Space", "-leading", "a" * 80, "", "wi th"])
def test_invalid_slugs_are_rejected(client_as_owner, slug):
    response = client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": slug, "kind": "openai"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["field"] == "slug"


@pytest.mark.django_db
def test_slug_case_is_normalised_rather_than_rejected(client_as_owner):
    response = client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "MyBox", "kind": "openai"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["slug"] == "mybox"


# -------------------------------------------------------------------- listing

@pytest.mark.django_db
def test_config_declared_providers_are_listed_and_read_only(client_as_owner):
    body = client_as_owner.get("/api/llm/providers/").json()
    by_slug = {p["slug"]: p for p in body["providers"]}
    # config/models.yaml declares `local`.
    assert "local" in by_slug
    assert by_slug["local"]["source"] == "config"
    assert by_slug["local"]["editable"] is False


@pytest.mark.django_db
def test_owner_providers_are_editable(client_as_owner):
    client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "mine", "kind": "ollama", "base_url": "http://localhost:11434"},
        content_type="application/json",
    )
    body = client_as_owner.get("/api/llm/providers/").json()
    entry = next(p for p in body["providers"] if p["slug"] == "mine")
    assert entry["source"] == "owner"
    assert entry["editable"] is True


@pytest.mark.django_db
def test_deleting_a_provider(client_as_owner):
    client_as_owner.post(
        "/api/llm/providers/",
        data={"slug": "temp", "kind": "openai"},
        content_type="application/json",
    )
    assert client_as_owner.delete("/api/llm/providers/temp/").status_code == 204
    assert client_as_owner.delete("/api/llm/providers/temp/").status_code == 404


# ------------------------------------------------------------------- discovery

@pytest.mark.django_db
def test_unreachable_provider_returns_200_not_500(client_as_owner):
    """An unreachable local server is a normal state. If this 500s, the settings
    page shows a failed request instead of "that box is off"."""
    client_as_owner.post(
        "/api/llm/providers/",
        data={
            "slug": "offline-box",
            "kind": "ollama",
            # Reserved-for-documentation address: guaranteed not to answer.
            "base_url": "http://192.0.2.1:11434",
            "connect_timeout": 0.5,
        },
        content_type="application/json",
    )
    response = client_as_owner.get("/api/llm/models/?provider=offline-box")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["models"] == []
    assert body["error"]


@pytest.mark.django_db
def test_models_for_an_unknown_provider_is_404(client_as_owner):
    assert client_as_owner.get("/api/llm/models/?provider=nope").status_code == 404


@pytest.mark.django_db
def test_kinds_lists_every_known_adapter(client_as_owner):
    body = client_as_owner.get("/api/llm/kinds/").json()
    ids = {k["id"] for k in body["kinds"]}
    assert ids == set(registry.KNOWN_KINDS)
    hosted = {k["id"] for k in body["kinds"] if k["needs_key"]}
    assert hosted == registry.HOSTED_KINDS
