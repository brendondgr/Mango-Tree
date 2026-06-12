from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from utils.apps.media_viewer.shared.constants import MANIFEST_FILENAME, MANIFEST_VERSION
from utils.apps.media_viewer.shared.schemas import ArtifactRecord, Manifest


class ManifestStore:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._lock = threading.RLock()
        self._manifest_path = root / MANIFEST_FILENAME

    @property
    def path(self) -> Path:
        return self._manifest_path

    def ensure_directories(self) -> None:
        self._root.mkdir(parents=True, exist_ok=True)

    def load(self) -> Manifest:
        self.ensure_directories()
        if not self._manifest_path.exists():
            manifest = Manifest.empty()
            self.save(manifest)
            return manifest

        try:
            with self._manifest_path.open(encoding="utf-8") as handle:
                data = json.load(handle)
            manifest = Manifest.from_dict(data)
            if manifest.version != MANIFEST_VERSION:
                manifest.version = MANIFEST_VERSION
            return manifest
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            manifest = Manifest.empty()
            self.save(manifest)
            return manifest

    def save(self, manifest: Manifest) -> None:
        self.ensure_directories()
        manifest.version = MANIFEST_VERSION
        manifest.updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
            "+00:00",
            "Z",
        )
        payload = json.dumps(manifest.to_dict(), indent=2, sort_keys=True)
        temp_path = self._manifest_path.with_suffix(".json.tmp")
        with self._lock:
            with temp_path.open("w", encoding="utf-8") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, self._manifest_path)

    def update(self, mutator) -> Manifest:
        with self._lock:
            manifest = self.load()
            mutator(manifest)
            self.save(manifest)
            return manifest

    def get_artifact(self, artifact_id: str) -> ArtifactRecord | None:
        manifest = self.load()
        for artifact in manifest.artifacts:
            if artifact.id == artifact_id:
                return artifact
        return None

    def list_artifacts(
        self,
        *,
        kind: str | None = None,
        limit: int | None = None,
    ) -> list[ArtifactRecord]:
        manifest = self.load()
        artifacts = sorted(
            manifest.artifacts,
            key=lambda item: item.created_at,
            reverse=True,
        )
        if kind:
            artifacts = [item for item in artifacts if item.kind == kind]
        if limit is not None:
            artifacts = artifacts[:limit]
        return artifacts
