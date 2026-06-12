from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from utils.apps.media_viewer.shared.constants import ArtifactKind, ArtifactSource


@dataclass
class ArtifactMetadata:
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    page_count: int | None = None
    language: str | None = None
    checksum_sha256: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> ArtifactMetadata:
        if not data:
            return cls()
        return cls(
            width=data.get("width"),
            height=data.get("height"),
            duration_seconds=data.get("duration_seconds"),
            page_count=data.get("page_count"),
            language=data.get("language"),
            checksum_sha256=data.get("checksum_sha256"),
        )


@dataclass
class ArtifactRecord:
    id: str
    filename: str
    storage_path: str
    mime_type: str
    kind: ArtifactKind
    size_bytes: int
    created_at: str
    source: ArtifactSource
    thumbnail_path: str | None = None
    source_chat_session_id: str | None = None
    source_message_id: str | None = None
    metadata: ArtifactMetadata = field(default_factory=ArtifactMetadata)

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "id": self.id,
            "filename": self.filename,
            "storage_path": self.storage_path,
            "thumbnail_path": self.thumbnail_path,
            "mime_type": self.mime_type,
            "kind": self.kind,
            "size_bytes": self.size_bytes,
            "created_at": self.created_at,
            "source": self.source,
            "source_chat_session_id": self.source_chat_session_id,
            "source_message_id": self.source_message_id,
            "metadata": self.metadata.to_dict(),
        }
        return payload

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ArtifactRecord:
        return cls(
            id=data["id"],
            filename=data["filename"],
            storage_path=data["storage_path"],
            thumbnail_path=data.get("thumbnail_path"),
            mime_type=data["mime_type"],
            kind=data["kind"],
            size_bytes=int(data["size_bytes"]),
            created_at=data["created_at"],
            source=data.get("source", "manual"),
            source_chat_session_id=data.get("source_chat_session_id"),
            source_message_id=data.get("source_message_id"),
            metadata=ArtifactMetadata.from_dict(data.get("metadata")),
        )


@dataclass
class Manifest:
    version: int
    updated_at: str
    artifacts: list[ArtifactRecord] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "updated_at": self.updated_at,
            "artifacts": [artifact.to_dict() for artifact in self.artifacts],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Manifest:
        artifacts = [
            ArtifactRecord.from_dict(entry)
            for entry in data.get("artifacts") or []
        ]
        return cls(
            version=int(data.get("version", 1)),
            updated_at=data.get("updated_at")
            or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            artifacts=artifacts,
        )

    @classmethod
    def empty(cls) -> Manifest:
        return cls(
            version=1,
            updated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
                "+00:00",
                "Z",
            ),
            artifacts=[],
        )
