from __future__ import annotations

from django.db import models


class Step(models.Model):
    """An ordered instruction line for a recipe. Bound to the legacy ``steps``
    table."""

    id = models.AutoField(primary_key=True)
    recipe = models.ForeignKey(
        "recipes.Recipe",
        on_delete=models.DO_NOTHING,
        db_column="recipe_id",
        related_name="steps",
    )
    step_number = models.IntegerField()
    instruction = models.TextField()

    class Meta:
        app_label = "recipes"
        managed = False
        db_table = "steps"
