"""Thin request-parsing helpers for the IMDbSpy DRF views.

Serialization of persisted objects is handled by ``model.to_dict()`` (the single
source of truth for the wire shape); these helpers only normalize inbound
payloads before they reach a service.
"""

from __future__ import annotations

from typing import Any

from utils.apps.imdbspy.shared.errors import ValidationError

# Per-criterion rating fields accepted by the review endpoint.
RATING_FIELDS = (
    "entertaining_rating",
    "momentum_rating",
    "characters_rating",
    "rewatchability_rating",
    "immersive_rating",
    "stakes_rating",
    "heart_rating",
)


def parse_object(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValidationError("Expected a JSON object")
    return data


def extract_ratings(data: dict[str, Any]) -> dict[str, Any]:
    """Pull only the recognized ``*_rating`` keys from a review payload."""
    return {field: data[field] for field in RATING_FIELDS if field in data}


def int_param(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
