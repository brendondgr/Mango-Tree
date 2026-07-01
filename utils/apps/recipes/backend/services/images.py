"""Recipe image uploads. Files are written under ``<recipes-data-dir>/images/``
(co-located with the recipes DB) and served back through the API. Writes and
reads are confined to that directory; filenames are randomized on upload and
sanitized on read to block path traversal."""

from __future__ import annotations

import os
import uuid

from utils.apps.recipes.backend.services import store
from utils.apps.recipes.shared.constants import ALLOWED_IMAGE_EXTENSIONS
from utils.apps.recipes.shared.errors import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


def images_dir() -> str:
    return os.path.join(os.path.dirname(store._db_path()), "images")


def save_uploaded_image(filename: str, data: bytes) -> str:
    """Persist uploaded bytes under a randomized name and return the served URL."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            "Invalid file type. Allowed: " + ", ".join(ALLOWED_IMAGE_EXTENSIONS),
            details={"field": "image"},
        )
    if not data:
        raise ValidationError("Empty image file", details={"field": "image"})

    directory = images_dir()
    os.makedirs(directory, exist_ok=True)
    stored_name = f"{uuid.uuid4()}{ext}"
    with open(os.path.join(directory, stored_name), "wb") as handle:
        handle.write(data)
    return f"/api/recipes/images/{stored_name}"


def resolve_image_path(filename: str) -> str:
    """Resolve a stored image to an absolute path, refusing traversal."""
    if not filename or filename != os.path.basename(filename) or filename in {".", ".."}:
        raise PermissionDeniedError("Invalid image name", details={"name": filename})
    directory = images_dir()
    path = os.path.normpath(os.path.join(directory, filename))
    if os.path.dirname(path) != os.path.normpath(directory):
        raise PermissionDeniedError("Invalid image name", details={"name": filename})
    if not os.path.isfile(path):
        raise NotFoundError("Image not found", details={"name": filename})
    return path
