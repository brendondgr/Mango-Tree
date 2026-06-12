from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from utils.apps.media_viewer.shared.config import load_artifacts_config
from utils.apps.media_viewer.shared.constants import (
    STORAGE_DIR,
    THUMBNAILS_DIR,
    ArtifactKind,
    ArtifactSource,
    ArtifactsConfig,
)
from utils.apps.media_viewer.shared.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from utils.apps.media_viewer.shared.schemas import ArtifactMetadata, ArtifactRecord
from utils.apps.media_viewer.backend.services.classification import (
    classify_file,
    get_extension,
    get_language_from_filename,
    validate_filename,
)
from utils.apps.media_viewer.backend.services.manifest import ManifestStore


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _resolve_under_root(root: Path, relative_path: str) -> Path:
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise PermissionDeniedError("Path escapes artifact root") from exc
    return candidate


class ArtifactStore:
    def __init__(self, config: ArtifactsConfig | None = None) -> None:
        self._config = config or load_artifacts_config()
        self._manifest = ManifestStore(self._config.root)

    @property
    def config(self) -> ArtifactsConfig:
        return self._config

    @property
    def root(self) -> Path:
        return self._config.root

    def _ensure_layout(self) -> None:
        self._manifest.ensure_directories()
        (self._config.root / STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        (self._config.root / THUMBNAILS_DIR).mkdir(parents=True, exist_ok=True)

    def _validate_size(self, *, kind: ArtifactKind, size_bytes: int) -> None:
        if kind == "image" and size_bytes > self._config.max_image_size_bytes:
            raise ValidationError("Image exceeds maximum size")
        if kind == "pdf" and size_bytes > self._config.max_pdf_size_bytes:
            raise ValidationError("PDF exceeds maximum size")
        if size_bytes > self._config.max_file_size_bytes:
            raise ValidationError("File exceeds maximum size")

    def _validate_kind(self, kind: ArtifactKind) -> None:
        if kind not in self._config.allowed_kinds:
            raise ValidationError(f"Artifact kind '{kind}' is not allowed")

    def _build_metadata(
        self,
        *,
        filename: str,
        kind: ArtifactKind,
        data: bytes,
    ) -> ArtifactMetadata:
        checksum = hashlib.sha256(data).hexdigest()
        language = get_language_from_filename(filename)
        width = height = None

        if kind == "image":
            try:
                from PIL import Image

                with Image.open(BytesIO(data)) as image:
                    width, height = image.size
            except Exception:
                pass

        return ArtifactMetadata(
            width=width,
            height=height,
            language=language,
            checksum_sha256=checksum,
        )

    def save(
        self,
        *,
        filename: str,
        data: bytes,
        mime_type: str,
        source: ArtifactSource = "manual",
        source_chat_session_id: str | None = None,
        source_message_id: str | None = None,
        thumbnail_data: bytes | None = None,
    ) -> ArtifactRecord:
        validate_filename(filename)
        kind = classify_file(filename=filename, mime_type=mime_type)
        self._validate_kind(kind)
        self._validate_size(kind=kind, size_bytes=len(data))
        self._ensure_layout()

        artifact_id = str(uuid.uuid4())
        ext = get_extension(filename)
        storage_relative = f"{STORAGE_DIR}/{artifact_id}{ext}"
        storage_path = _resolve_under_root(self._config.root, storage_relative)
        storage_path.write_bytes(data)

        thumbnail_relative = None
        if thumbnail_data:
            thumbnail_relative = f"{THUMBNAILS_DIR}/{artifact_id}.webp"
            thumbnail_path = _resolve_under_root(self._config.root, thumbnail_relative)
            thumbnail_path.write_bytes(thumbnail_data)

        record = ArtifactRecord(
            id=artifact_id,
            filename=filename,
            storage_path=storage_relative,
            thumbnail_path=thumbnail_relative,
            mime_type=mime_type or "application/octet-stream",
            kind=kind,
            size_bytes=len(data),
            created_at=_utc_now_iso(),
            source=source,
            source_chat_session_id=source_chat_session_id,
            source_message_id=source_message_id,
            metadata=self._build_metadata(filename=filename, kind=kind, data=data),
        )

        def mutator(manifest) -> None:
            manifest.artifacts.append(record)

        self._manifest.update(mutator)
        try:
            from utils.shared.events.trace import emit_trace_event

            emit_trace_event(
                action="artifact_saved",
                artifact_id=record.id,
                details={"filename": record.filename, "kind": record.kind, "source": record.source},
            )
        except OSError:
            pass
        return record

    def get(self, artifact_id: str) -> ArtifactRecord:
        record = self._manifest.get_artifact(artifact_id)
        if record is None:
            raise NotFoundError("Artifact not found")
        return record

    def list(
        self,
        *,
        kind: str | None = None,
        limit: int | None = None,
    ) -> list[ArtifactRecord]:
        self._ensure_layout()
        return self._manifest.list_artifacts(kind=kind, limit=limit)

    def read_content(self, artifact_id: str) -> tuple[ArtifactRecord, bytes]:
        record = self.get(artifact_id)
        path = _resolve_under_root(self._config.root, record.storage_path)
        if not path.is_file():
            raise NotFoundError("Artifact content not found")
        return record, path.read_bytes()

    def read_thumbnail(self, artifact_id: str) -> tuple[ArtifactRecord, bytes]:
        record = self.get(artifact_id)
        if not record.thumbnail_path:
            raise NotFoundError("Artifact thumbnail not found")
        path = _resolve_under_root(self._config.root, record.thumbnail_path)
        if not path.is_file():
            raise NotFoundError("Artifact thumbnail not found")
        return record, path.read_bytes()

    def delete(self, artifact_id: str) -> None:
        record = self.get(artifact_id)
        storage_path = _resolve_under_root(self._config.root, record.storage_path)
        thumbnail_path = (
            _resolve_under_root(self._config.root, record.thumbnail_path)
            if record.thumbnail_path
            else None
        )

        removed_manifest = False

        def mutator(manifest) -> None:
            nonlocal removed_manifest
            before = len(manifest.artifacts)
            manifest.artifacts = [
                item for item in manifest.artifacts if item.id != artifact_id
            ]
            removed_manifest = len(manifest.artifacts) < before

        self._manifest.update(mutator)
        if not removed_manifest:
            raise NotFoundError("Artifact not found")

        try:
            if storage_path.is_file():
                storage_path.unlink()
            if thumbnail_path and thumbnail_path.is_file():
                thumbnail_path.unlink()
        except OSError as exc:
            raise ConflictError("Failed to delete artifact files") from exc

        try:
            from utils.shared.events.trace import emit_trace_event

            emit_trace_event(
                action="artifact_deleted",
                artifact_id=artifact_id,
                details={"filename": record.filename, "kind": record.kind},
            )
        except OSError:
            pass
