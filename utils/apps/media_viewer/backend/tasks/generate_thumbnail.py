from __future__ import annotations


def generate_thumbnail_for_artifact(artifact_id: str) -> None:
    """Celery entrypoint for deferred thumbnail generation (video/pdf).

    v1 generates image and client-poster thumbnails during upload. This task
    remains a hook for future async PDF first-page and server-side video poster work.
    """
    _ = artifact_id
