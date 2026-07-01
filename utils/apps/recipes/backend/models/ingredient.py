from __future__ import annotations

from django.db import models


class Ingredient(models.Model):
    """A pantry ingredient. Bound to the legacy ``ingredients`` table. ``name`` is
    stored lowercased and unique, exactly as the legacy app stored it."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(max_length=100, default="Other")

    class Meta:
        app_label = "recipes"
        managed = False
        db_table = "ingredients"
