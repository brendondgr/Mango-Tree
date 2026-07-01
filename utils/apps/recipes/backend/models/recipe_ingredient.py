from __future__ import annotations

from django.db import models


class RecipeIngredient(models.Model):
    """Link row between a recipe and an ingredient, carrying the per-recipe
    quantity/unit and whether the ingredient is optional. Bound to the legacy
    ``recipe_ingredients`` table."""

    id = models.AutoField(primary_key=True)
    recipe = models.ForeignKey(
        "recipes.Recipe",
        on_delete=models.DO_NOTHING,
        db_column="recipe_id",
        related_name="recipe_ingredients",
    )
    ingredient = models.ForeignKey(
        "recipes.Ingredient",
        on_delete=models.DO_NOTHING,
        db_column="ingredient_id",
        related_name="recipe_links",
    )
    quantity = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=64, null=True, blank=True)
    is_optional = models.IntegerField(default=0)

    class Meta:
        app_label = "recipes"
        managed = False
        db_table = "recipe_ingredients"
