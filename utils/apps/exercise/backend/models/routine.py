from __future__ import annotations

from django.db import models


class Routine(models.Model):
    """A weekly schedule mapping each weekday to a list of workout IDs.

    Bound to the legacy ``routines`` table. ``workouts`` holds a JSON object
    (``{"Mon": [...], ...}``) stored as TEXT. Some legacy rows stored a bare
    JSON list instead; the service normalizes that on read.
    """

    id = models.TextField(primary_key=True)
    name = models.TextField()
    description = models.TextField(null=True, blank=True)
    workouts = models.TextField()

    class Meta:
        managed = False
        db_table = "routines"
