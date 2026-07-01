"""Media-cache path resolution + serving.

Scraped posters and headshots are cached under a media root (default
``data/imdbspy/media/``, override ``MANGO_IMDBSPY_MEDIA_DIR``). ``resolve_asset``
maps a stored relative path (e.g. ``tv-movie/12345.webp``) to an absolute file,
denying anything that escapes the root — this is the filesystem permission
boundary for the ``imdbspy_media`` scope.
"""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings

from utils.apps.imdbspy.shared.constants import MEDIA_ACTORS_DIR, MEDIA_TVMOVIE_DIR
from utils.apps.imdbspy.shared.errors import NotFoundError, ValidationError


def media_root() -> Path:
    """Absolute path to the media cache root."""
    override = os.environ.get("MANGO_IMDBSPY_MEDIA_DIR")
    if override:
        return Path(override)
    return Path(settings.BASE_DIR) / "data" / "imdbspy" / "media"


def ensure_media_dirs() -> Path:
    """Create the media root and its actor/poster subdirectories."""
    root = media_root()
    (root / MEDIA_ACTORS_DIR).mkdir(parents=True, exist_ok=True)
    (root / MEDIA_TVMOVIE_DIR).mkdir(parents=True, exist_ok=True)
    return root


def resolve_asset(rel_path: str) -> Path:
    """Resolve a media-relative path to an absolute file inside the root.

    Raises ``ValidationError`` for empty/absolute/traversing paths and
    ``NotFoundError`` when the resolved file does not exist. The traversal check
    is the enforced denial for the ``imdbspy_media`` scope.
    """
    if not rel_path or not isinstance(rel_path, str):
        raise ValidationError("Media path is required", details={"path": rel_path})
    normalized = rel_path.replace("\\", "/").strip()
    if normalized.startswith("/") or ".." in normalized.split("/"):
        raise ValidationError("Invalid media path", details={"path": rel_path})

    root = media_root().resolve()
    candidate = (root / normalized).resolve()
    if not candidate.is_relative_to(root):
        raise ValidationError("Path traversal denied", details={"path": rel_path})
    if not candidate.is_file():
        raise NotFoundError("Media asset not found", details={"path": rel_path})
    return candidate
