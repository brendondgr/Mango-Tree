from __future__ import annotations

from pathlib import PurePosixPath

from utils.apps.media_viewer.shared.constants import (
    EXTENSION_LANGUAGE,
    TEXT_EXTENSIONS,
    ArtifactKind,
)
from utils.apps.media_viewer.shared.errors import PermissionDeniedError, ValidationError


def get_extension(filename: str) -> str:
    dot = filename.rfind(".")
    if dot == -1:
        return ""
    return filename[dot:].lower()


def get_language_from_filename(filename: str) -> str | None:
    ext = get_extension(filename)
    if not ext:
        return None
    return EXTENSION_LANGUAGE.get(ext)


def classify_file(*, filename: str, mime_type: str) -> ArtifactKind:
    mime = (mime_type or "").lower()
    ext = get_extension(filename)

    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime == "application/pdf" or ext == ".pdf":
        return "pdf"
    if ext == ".md":
        return "markdown"
    if ext == ".tex":
        return "latex"
    if mime.startswith("text/") or ext in TEXT_EXTENSIONS:
        return "text"

    return "unknown"


def validate_filename(filename: str) -> None:
    if not filename or not filename.strip():
        raise ValidationError("Filename is required")

    if "\x00" in filename:
        raise ValidationError("Filename contains invalid characters")

    normalized = PurePosixPath(filename.replace("\\", "/"))
    if normalized.is_absolute():
        raise PermissionDeniedError("Absolute paths are not allowed in filenames")

    if ".." in normalized.parts:
        raise PermissionDeniedError("Path traversal is not allowed in filenames")

    if len(normalized.parts) != 1:
        raise PermissionDeniedError("Nested paths are not allowed in filenames")
