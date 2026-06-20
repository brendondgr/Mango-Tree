from __future__ import annotations

from django.db import models


class History(models.Model):
    """A logged workout session.

    Bound to the legacy ``history`` table. ``workout_id`` references
    ``workouts.id`` (the legacy schema declares a FK with ON DELETE CASCADE);
    it is kept as a plain TEXT column to mirror the stored data exactly.
    ``exercises`` holds a JSON array stored as TEXT. ``start_time`` was added to
    the live schema via ALTER and may be null on older rows.
    """

    id = models.TextField(primary_key=True)
    workout_id = models.TextField()
    date = models.TextField()
    duration = models.IntegerField()
    volume = models.FloatField()
    notes = models.TextField(null=True, blank=True)
    exercises = models.TextField()
    start_time = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "history"
