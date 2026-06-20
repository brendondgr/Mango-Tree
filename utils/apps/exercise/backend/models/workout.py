from __future__ import annotations

from django.db import models


class Workout(models.Model):
    """A workout template: an ordered set of exercises.

    Bound to the legacy ``workouts`` table. ``exercises`` holds a JSON array of
    exercise objects, stored as TEXT exactly as the original app stored it; the
    service layer is responsible for (de)serialization.
    """

    id = models.TextField(primary_key=True)
    name = models.TextField()
    color = models.TextField()
    exercises = models.TextField()

    class Meta:
        managed = False
        db_table = "workouts"
