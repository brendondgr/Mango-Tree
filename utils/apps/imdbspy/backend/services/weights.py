"""Rating-weights services (API-only configuration surface).

Reading and updating the per-scale criterion weights, plus recalculating the
stored ``user_rating`` of every affected title when weights change — using the
same score math as ``update_review`` (``shared/ratings``).
"""

from __future__ import annotations

from typing import Any

from utils.apps.imdbspy.backend.models import MediaItem, RatingWeights
from utils.apps.imdbspy.shared.errors import ValidationError
from utils.apps.imdbspy.shared.ratings import compute_score


def get_weights() -> list[RatingWeights]:
    return list(RatingWeights.objects.all())


def _recalc_scale(weights: RatingWeights) -> None:
    scale_type = weights.scale_type
    for item in MediaItem.objects.filter(scale_type=scale_type):
        item.user_rating = compute_score(
            scale_type,
            lambda c: getattr(item, f"{c}_rating"),
            lambda c: getattr(weights, f"{c}_weight"),
        )
        item.save(update_fields=["user_rating"])


def update_weights(payload: Any) -> list[dict[str, Any]]:
    """Update one or more scales' weights, then recalc affected titles.

    ``payload`` is a list of ``{scale_type, <criterion>_weight: float, ...}``.
    Unknown scales are skipped; unknown keys are ignored; non-numeric weights
    raise ``validation_error``.
    """
    if not isinstance(payload, list):
        raise ValidationError("Expected an array of weight objects")

    updated: list[RatingWeights] = []
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        scale_type = entry.get("scale_type")
        if not scale_type:
            continue
        weight_obj = RatingWeights.objects.filter(scale_type=scale_type).first()
        if weight_obj is None:
            continue

        for key, value in entry.items():
            if key in ("id", "scale_type"):
                continue
            if key.endswith("_weight") and hasattr(weight_obj, key):
                try:
                    setattr(weight_obj, key, float(value))
                except (TypeError, ValueError):
                    raise ValidationError(
                        f"Invalid weight value for {key}", details={key: value}
                    )
        weight_obj.save()
        updated.append(weight_obj)

    for weight_obj in updated:
        _recalc_scale(weight_obj)

    return [w.to_dict() for w in updated]
