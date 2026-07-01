from __future__ import annotations

from typing import Any

from django.db import models


class RatingWeights(models.Model):
    """Per-scale criterion weights for the weighted rating system.

    One row per scale (``fun`` / ``grit`` / ``comfort``); the three defaults are
    seeded on migrate. Each scale uses four of the criterion weights (they all
    default to 0.25 so a scale's weights sum to 1.0).
    """

    id = models.BigAutoField(primary_key=True)
    scale_type = models.CharField(max_length=20, unique=True)  # fun/grit/comfort

    entertaining_weight = models.FloatField(default=0.25)
    momentum_weight = models.FloatField(default=0.25)  # fun only
    characters_weight = models.FloatField(default=0.25)
    rewatchability_weight = models.FloatField(default=0.25)
    immersive_weight = models.FloatField(default=0.25)  # grit only
    stakes_weight = models.FloatField(default=0.25)  # grit only
    heart_weight = models.FloatField(default=0.25)  # comfort only

    class Meta:
        app_label = "imdbspy"
        managed = True
        db_table = "rating_weights"

    def __str__(self) -> str:  # pragma: no cover - debug convenience
        return f"weights:{self.scale_type}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "scale_type": self.scale_type,
            "entertaining_weight": self.entertaining_weight,
            "momentum_weight": self.momentum_weight,
            "characters_weight": self.characters_weight,
            "rewatchability_weight": self.rewatchability_weight,
            "immersive_weight": self.immersive_weight,
            "stakes_weight": self.stakes_weight,
            "heart_weight": self.heart_weight,
        }
