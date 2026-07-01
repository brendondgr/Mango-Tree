"""Weighted Fun/Grit/Comfort score — the single source of truth.

The legacy Flask app duplicated this arithmetic in three places (add,
update-review, and the weights-recalc path). It lives here once and is used by
``services/media_items.update_review`` and ``services/weights.update_weights``.

Each scale scores four criteria (each rated 0–5) by its per-criterion weights
(which sum to 1.0), producing a 0–5 value that is doubled to a 0–10 user rating.
"""

from __future__ import annotations

from typing import Callable

# Bare criterion names per scale. Model fields are ``<criterion>_rating`` and
# weight fields are ``<criterion>_weight``.
SCALE_CRITERIA: dict[str, list[str]] = {
    "fun": ["entertaining", "momentum", "characters", "rewatchability"],
    "grit": ["immersive", "stakes", "characters", "rewatchability"],
    "comfort": ["entertaining", "heart", "characters", "rewatchability"],
}


def criteria_for(scale_type: str) -> list[str]:
    return SCALE_CRITERIA.get(scale_type, [])


def compute_score(
    scale_type: str,
    get_rating: Callable[[str], float | None],
    get_weight: Callable[[str], float | None],
) -> float:
    """Return the 0–10 user rating for ``scale_type``.

    ``get_rating(criterion)`` yields the 0–5 rating and ``get_weight(criterion)``
    the criterion weight. Missing values count as 0. Result is rounded to one
    decimal place, matching the original app.
    """
    criteria = SCALE_CRITERIA.get(scale_type)
    if not criteria:
        return 0.0
    score = sum((get_rating(c) or 0.0) * (get_weight(c) or 0.0) for c in criteria)
    return round(score * 2, 1)
