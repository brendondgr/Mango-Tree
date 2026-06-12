from __future__ import annotations

import concurrent.futures
from pathlib import Path

import pytest

from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore
from utils.apps.media_viewer.backend.services.classification import classify_file
from utils.apps.media_viewer.shared.config import ArtifactsConfig
from utils.apps.media_viewer.shared.constants import STORAGE_DIR, THUMBNAILS_DIR
from utils.apps.media_viewer.shared.errors import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


@pytest.fixture
def artifacts_config(tmp_path: Path) -> ArtifactsConfig:
    root = tmp_path / "artifacts"
    return ArtifactsConfig(
        root=root,
        max_file_size_bytes=20 * 1024 * 1024,
        max_image_size_bytes=5 * 1024 * 1024,
        max_pdf_size_bytes=10 * 1024 * 1024,
        allowed_kinds=frozenset(
            {"image", "video", "pdf", "markdown", "latex", "text"},
        ),
    )


@pytest.fixture
def store(artifacts_config: ArtifactsConfig) -> ArtifactStore:
    return ArtifactStore(artifacts_config)


def test_save_writes_storage_and_manifest(store: ArtifactStore, artifacts_config: ArtifactsConfig) -> None:
    record = store.save(
        filename="diagram.png",
        data=b"fake-png-bytes",
        mime_type="image/png",
        source="manual",
    )

    storage_path = artifacts_config.root / record.storage_path
    manifest_path = artifacts_config.root / "manifest.json"

    assert storage_path.is_file()
    assert manifest_path.is_file()
    assert record.kind == "image"
    assert record.metadata.checksum_sha256
    assert store.get(record.id).filename == "diagram.png"


def test_save_rejects_path_traversal_filename(store: ArtifactStore) -> None:
    with pytest.raises(PermissionDeniedError):
        store.save(
            filename="../escape.png",
            data=b"x",
            mime_type="image/png",
        )


def test_save_rejects_oversize_file(store: ArtifactStore) -> None:
    with pytest.raises(ValidationError):
        store.save(
            filename="large.png",
            data=b"x" * (6 * 1024 * 1024),
            mime_type="image/png",
        )


def test_save_rejects_disallowed_kind(store: ArtifactStore) -> None:
    with pytest.raises(ValidationError):
        store.save(
            filename="archive.zip",
            data=b"zip",
            mime_type="application/zip",
        )


def test_delete_removes_files_and_manifest_entry(
    store: ArtifactStore,
    artifacts_config: ArtifactsConfig,
) -> None:
    record = store.save(
        filename="note.md",
        data=b"# hello",
        mime_type="text/markdown",
        thumbnail_data=b"thumb",
    )
    storage_path = artifacts_config.root / record.storage_path
    thumbnail_path = artifacts_config.root / record.thumbnail_path

    store.delete(record.id)

    assert not storage_path.exists()
    assert not thumbnail_path.exists()
    assert store.list() == []


def test_delete_missing_id_raises_not_found(store: ArtifactStore) -> None:
    with pytest.raises(NotFoundError):
        store.delete("missing-id")


def test_manifest_atomic_write_under_concurrent_saves(store: ArtifactStore) -> None:
    def save_one(index: int) -> str:
        record = store.save(
            filename=f"file-{index}.txt",
            data=f"content-{index}".encode(),
            mime_type="text/plain",
        )
        return record.id

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        ids = list(executor.map(save_one, range(20)))

    listed = store.list()
    assert len(listed) == 20
    assert {item.id for item in listed} == set(ids)


def test_list_filters_by_kind(store: ArtifactStore) -> None:
    image = store.save(filename="a.png", data=b"a", mime_type="image/png")
    store.save(filename="b.txt", data=b"b", mime_type="text/plain")

    images = store.list(kind="image")
    assert len(images) == 1
    assert images[0].id == image.id


@pytest.mark.parametrize(
    ("filename", "mime_type", "expected"),
    [
        ("photo.jpg", "image/jpeg", "image"),
        ("clip.mp4", "video/mp4", "video"),
        ("doc.pdf", "application/pdf", "pdf"),
        ("readme.md", "text/plain", "markdown"),
        ("paper.tex", "application/x-tex", "latex"),
        ("main.py", "text/x-python", "text"),
    ],
)
def test_classification_matches_chat_rules(
    filename: str,
    mime_type: str,
    expected: str,
) -> None:
    assert classify_file(filename=filename, mime_type=mime_type) == expected


def test_corrupt_manifest_recovers_to_empty(store: ArtifactStore, artifacts_config: ArtifactsConfig) -> None:
    artifacts_config.root.mkdir(parents=True, exist_ok=True)
    manifest_path = artifacts_config.root / "manifest.json"
    manifest_path.write_text("{not valid json", encoding="utf-8")

    assert store.list() == []
    reloaded = manifest_path.read_text(encoding="utf-8")
    assert '"artifacts"' in reloaded
    assert '"version"' in reloaded


def test_layout_directories_created(store: ArtifactStore, artifacts_config: ArtifactsConfig) -> None:
    store.save(filename="x.txt", data=b"x", mime_type="text/plain")
    assert (artifacts_config.root / STORAGE_DIR).is_dir()
    assert (artifacts_config.root / THUMBNAILS_DIR).is_dir()
