from __future__ import annotations

from django.db import models


class RecipeImage(models.Model):
    """An ordered image URL for a recipe. Bound to the legacy ``recipe_images``
    table."""

    id = models.AutoField(primary_key=True)
    recipe = models.ForeignKey(
        "recipes.Recipe",
        on_delete=models.DO_NOTHING,
        db_column="recipe_id",
        related_name="images",
    )
    image_url = models.TextField(null=True, blank=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "recipes"
        managed = False
        db_table = "recipe_images"
