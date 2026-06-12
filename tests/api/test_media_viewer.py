from __future__ import annotations

import io
import uuid
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from utils.apps.media_viewer.shared.config import ArtifactsConfig


@pytest.fixture
def artifacts_config(tmp_path: Path, settings, monkeypatch) -> ArtifactsConfig:
    root = tmp_path / "artifacts"
    config = ArtifactsConfig(
        root=root,
        max_file_size_bytes=20 * 1024 * 1024,
        max_image_size_bytes=5 * 1024 * 1024,
        max_pdf_size_bytes=10 * 1024 * 1024,
        allowed_kinds=frozenset(
            {"image", "video", "pdf", "markdown", "latex", "text"},
        ),
    )
    monkeypatch.setenv("MANGO_ARTIFACTS_ROOT", str(root))
    return config


@pytest.fixture
def api_client(artifacts_config: ArtifactsConfig) -> APIClient:
    return APIClient()


def _make_png() -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), color="red").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_list_artifacts_paginates(api_client: APIClient) -> None:
    for index in range(3):
        api_client.post(
            "/api/media-viewer/artifacts/",
            {
                "file": SimpleUploadedFile(
                    f"file-{index}.txt",
                    f"content-{index}".encode(),
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )

    response = api_client.get("/api/media-viewer/artifacts/?limit=2&page=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 3
    assert len(payload["results"]) == 2
    assert payload["next"] == 2


@pytest.mark.django_db
def test_post_multipart_upload(api_client: APIClient) -> None:
    png = _make_png()
    response = api_client.post(
        "/api/media-viewer/artifacts/",
        {
            "file": SimpleUploadedFile("photo.png", png, content_type="image/png"),
            "source": "manual",
        },
        format="multipart",
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["kind"] == "image"
    assert payload["filename"] == "photo.png"


@pytest.mark.django_db
def test_get_content_streams_bytes(api_client: APIClient) -> None:
    png = _make_png()
    created = api_client.post(
        "/api/media-viewer/artifacts/",
        {"file": SimpleUploadedFile("photo.png", png, content_type="image/png")},
        format="multipart",
    )
    artifact_id = created.json()["id"]
    response = api_client.get(f"/api/media-viewer/artifacts/{artifact_id}/content/")
    assert response.status_code == 200
    assert response.content == png
    assert response["Content-Type"] == "image/png"


@pytest.mark.django_db
def test_delete_artifact(api_client: APIClient) -> None:
    created = api_client.post(
        "/api/media-viewer/artifacts/",
        {
            "file": SimpleUploadedFile(
                "note.md",
                b"# hello",
                content_type="text/markdown",
            ),
        },
        format="multipart",
    )
    artifact_id = created.json()["id"]
    delete_response = api_client.delete(f"/api/media-viewer/artifacts/{artifact_id}/")
    assert delete_response.status_code == 204
    get_response = api_client.get(f"/api/media-viewer/artifacts/{artifact_id}/")
    assert get_response.status_code == 404
    assert get_response.json()["code"] == "not_found"


@pytest.mark.django_db
def test_invalid_uuid_returns_not_found(api_client: APIClient) -> None:
    response = api_client.get(
        f"/api/media-viewer/artifacts/{uuid.uuid4()}/",
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
