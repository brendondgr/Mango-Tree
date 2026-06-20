from __future__ import annotations

from utils.apps.exercise.backend.services import strava


def sync_strava_activities(period: str = "week") -> dict[str, int]:
    """Celery entrypoint for deferred Strava import.

    The body only delegates to the service so the same logic backs the API view,
    the agent tool, and any scheduled background run. (Celery is not yet wired in
    the platform; this remains the registration hook, mirroring media_viewer.)
    """
    return strava.sync_strava(period)
