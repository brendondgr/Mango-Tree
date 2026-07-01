from __future__ import annotations

from django.db import models


class Recipe(models.Model):
    """A recipe. Bound to the legacy ``recipes`` table (``managed = False`` so
    Django never issues DDL — the schema is owned by
    ``backend/services/store.py``)."""

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    image_url = models.TextField(null=True, blank=True)
    servings = models.IntegerField(default=4, null=True)
    cuisine_region = models.CharField(max_length=255, null=True, blank=True)
    meal_type = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "recipes"
        managed = False
        db_table = "recipes"
