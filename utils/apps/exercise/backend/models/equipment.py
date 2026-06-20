from __future__ import annotations

from django.db import models


class Equipment(models.Model):
    """A piece of equipment (weights, machines, bodyweight, cardio, ...).

    Bound to the legacy ``equipment`` table. ``is_bodyweight`` is stored as an
    INTEGER (0/1) exactly as the original app stored it; the service exposes it
    as a boolean.
    """

    id = models.TextField(primary_key=True)
    name = models.TextField()
    weight = models.FloatField(null=True, blank=True)
    min_weight = models.FloatField(null=True, blank=True)
    max_weight = models.FloatField(null=True, blank=True)
    unit = models.TextField(null=True, blank=True, default="lbs")
    is_bodyweight = models.IntegerField(null=True, blank=True, default=0)
    type = models.TextField()
    color = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "equipment"
