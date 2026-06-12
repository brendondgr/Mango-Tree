from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image

from utils.apps.media_viewer.shared.constants import THUMBNAILS_DIR
from utils.apps.media_viewer.shared.schemas import ArtifactRecord


def generate_image_thumbnail(data: bytes, *, max_size: int = 320) -> bytes:
    with Image.open(BytesIO(data)) as image:
        image = image.convert("RGB")
        image.thumbnail((max_size, max_size))
        buffer = BytesIO()
        image.save(buffer, format="WEBP", quality=80)
        return buffer.getvalue()


def thumbnail_relative_path(artifact_id: str) -> str:
    return f"{THUMBNAILS_DIR}/{artifact_id}.webp"


def generate_video_poster(poster_data: bytes) -> bytes:
    return generate_image_thumbnail(poster_data)


def build_thumbnail_for_upload(
    *,
    kind: str,
    data: bytes,
    poster_data: bytes | None = None,
) -> bytes | None:
    if kind == "image":
        return generate_image_thumbnail(data)
    if kind == "video" and poster_data:
        return generate_video_poster(poster_data)
    return None
