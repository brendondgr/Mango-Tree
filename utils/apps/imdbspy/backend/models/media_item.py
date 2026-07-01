from __future__ import annotations

from typing import Any

from django.db import models
from django.utils import timezone


class MediaItem(models.Model):
    """A tracked movie or TV series.

    Django owns this schema (``managed = True``) in the dedicated ``imdbspy``
    SQLite database. Field names/types mirror the original SQLAlchemy model so
    the serialized shape (``to_dict``) is unchanged from the Flask app.
    """

    id = models.BigAutoField(primary_key=True)
    imdb_id = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    kind = models.CharField(max_length=50, default="movie")  # 'movie' or 'tv series'
    genres = models.JSONField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    rating_count = models.IntegerField(null=True, blank=True)

    # TV specific
    creators = models.JSONField(null=True, blank=True)
    seasons = models.IntegerField(null=True, blank=True)
    seasons_seen = models.IntegerField(null=True, blank=True)  # watched seasons (X/N)
    episodes = models.IntegerField(null=True, blank=True)
    years = models.CharField(max_length=50, null=True, blank=True)

    # Movie specific
    directors = models.JSONField(null=True, blank=True)
    writers = models.JSONField(null=True, blank=True)
    runtime_minutes = models.IntegerField(null=True, blank=True)

    cast = models.JSONField(null=True, blank=True)
    title_image_path = models.CharField(max_length=255, null=True, blank=True)
    actor_image_paths = models.JSONField(null=True, blank=True)

    status = models.CharField(max_length=20, default="not_seen")
    # Vestigial legacy column, retained for schema fidelity; not serialized.
    is_seen = models.BooleanField(default=False)

    user_rating = models.FloatField(null=True, blank=True)
    user_review = models.TextField(null=True, blank=True)

    # Weighted rating system
    scale_type = models.CharField(max_length=20, null=True, blank=True)  # fun/grit/comfort
    entertaining_rating = models.FloatField(null=True, blank=True)
    momentum_rating = models.FloatField(null=True, blank=True)  # fun only
    characters_rating = models.FloatField(null=True, blank=True)
    rewatchability_rating = models.FloatField(null=True, blank=True)
    immersive_rating = models.FloatField(null=True, blank=True)  # grit only
    stakes_rating = models.FloatField(null=True, blank=True)  # grit only
    heart_rating = models.FloatField(null=True, blank=True)  # comfort only

    added_at = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "imdbspy"
        managed = True
        db_table = "media_items"
        ordering = ["-added_at"]

    def __str__(self) -> str:  # pragma: no cover - debug convenience
        return f"{self.title} ({self.imdb_id})"

    def to_dict(self) -> dict[str, Any]:
        """Serialized shape consumed by the API, agent tools, and frontend.

        Matches the original Flask app's ``MediaItem.to_dict`` (the ``is_seen``
        legacy column is intentionally omitted).
        """
        return {
            "id": self.id,
            "imdb_id": self.imdb_id,
            "title": self.title,
            "description": self.description,
            "kind": self.kind,
            "genres": self.genres,
            "rating": self.rating,
            "rating_count": self.rating_count,
            "creators": self.creators,
            "seasons": self.seasons,
            "seasons_seen": self.seasons_seen,
            "episodes": self.episodes,
            "years": self.years,
            "directors": self.directors,
            "writers": self.writers,
            "runtime_minutes": self.runtime_minutes,
            "cast": self.cast,
            "title_image_path": self.title_image_path,
            "actor_image_paths": self.actor_image_paths,
            "status": self.status,
            "user_rating": self.user_rating,
            "user_review": self.user_review,
            "scale_type": self.scale_type,
            "entertaining_rating": self.entertaining_rating,
            "momentum_rating": self.momentum_rating,
            "characters_rating": self.characters_rating,
            "rewatchability_rating": self.rewatchability_rating,
            "immersive_rating": self.immersive_rating,
            "stakes_rating": self.stakes_rating,
            "heart_rating": self.heart_rating,
            "added_at": self.added_at.isoformat() if self.added_at else None,
        }
