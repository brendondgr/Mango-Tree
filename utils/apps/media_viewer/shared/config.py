from __future__ import annotations

import os
from pathlib import Path

import yaml

from utils.apps.media_viewer.shared.constants import ArtifactsConfig

DEFAULT_ARTIFACTS_ROOT = "data/artifacts"
DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024
DEFAULT_MAX_IMAGE_SIZE = 5 * 1024 * 1024
DEFAULT_MAX_PDF_SIZE = 10 * 1024 * 1024
DEFAULT_ALLOWED_KINDS = frozenset(
    {"image", "video", "pdf", "markdown", "latex", "text"},
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _load_yaml_defaults() -> dict:
    config_path = repo_root() / "config" / "artifacts.yaml"
    if not config_path.is_file():
        return {}

    with config_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    return data.get("artifacts") or {}


def load_artifacts_config() -> ArtifactsConfig:
    yaml_defaults = _load_yaml_defaults()
    root_value = os.environ.get(
        "MANGO_ARTIFACTS_ROOT",
        yaml_defaults.get("root", DEFAULT_ARTIFACTS_ROOT),
    )
    root = Path(root_value)
    if not root.is_absolute():
        root = repo_root() / root

    allowed = yaml_defaults.get("allowed_kinds", list(DEFAULT_ALLOWED_KINDS))
    return ArtifactsConfig(
        root=root.resolve(),
        max_file_size_bytes=int(
            yaml_defaults.get("max_file_size_bytes", DEFAULT_MAX_FILE_SIZE),
        ),
        max_image_size_bytes=int(
            yaml_defaults.get("max_image_size_bytes", DEFAULT_MAX_IMAGE_SIZE),
        ),
        max_pdf_size_bytes=int(
            yaml_defaults.get("max_pdf_size_bytes", DEFAULT_MAX_PDF_SIZE),
        ),
        allowed_kinds=frozenset(str(kind) for kind in allowed),
    )
