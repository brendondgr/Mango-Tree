"""DTOs for the recipes app — the single schema definition shared by the DRF API
and the agent tools. Read DTOs expose ``to_dict()``; input DTOs validate through
``from_dict()`` and raise :class:`ValidationError`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from utils.apps.recipes.shared.constants import DEFAULT_CATEGORY, DEFAULT_SERVINGS
from utils.apps.recipes.shared.errors import ValidationError

# --- parsing helpers ----------------------------------------------------------


def _req_str(data: dict, key: str, *, max_len: int | None = None) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"'{key}' is required", details={"field": key})
    value = value.strip()
    if max_len and len(value) > max_len:
        raise ValidationError(
            f"'{key}' must be at most {max_len} characters", details={"field": key}
        )
    return value


def _opt_str(data: dict, key: str) -> Optional[str]:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, (str, int, float)):
        raise ValidationError(f"'{key}' must be a string", details={"field": key})
    text = str(value).strip()
    return text or None


def _opt_float(value: Any, *, field_name: str) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValidationError(
            f"'{field_name}' must be a number", details={"field": field_name}
        ) from None


def _opt_int(value: Any, default: int, *, field_name: str) -> int:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(
            f"'{field_name}' must be an integer", details={"field": field_name}
        ) from None


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


# --- read DTOs ----------------------------------------------------------------


@dataclass(frozen=True)
class IngredientDTO:
    id: int
    name: str
    category: str

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "category": self.category}


@dataclass(frozen=True)
class RecipeIngredientDTO:
    id: int  # the underlying ingredient id
    name: str
    quantity: Optional[float]
    unit: Optional[str]
    is_optional: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "quantity": self.quantity,
            "unit": self.unit,
            "is_optional": self.is_optional,
        }


@dataclass(frozen=True)
class StepDTO:
    step_number: int
    instruction: str

    def to_dict(self) -> dict[str, Any]:
        return {"step_number": self.step_number, "instruction": self.instruction}


@dataclass(frozen=True)
class RecipeSummaryDTO:
    id: int
    title: str
    description: Optional[str]
    servings: Optional[int]
    cuisine_region: Optional[str]
    meal_type: Optional[str]
    image_url: Optional[str]
    images: list[str] = field(default_factory=list)
    total_ingredients: int = 0
    matched_ingredients: int = 0
    match_percentage: Optional[float] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "servings": self.servings,
            "cuisine_region": self.cuisine_region,
            "meal_type": self.meal_type,
            "image_url": self.image_url,
            "images": self.images,
            "total_ingredients": self.total_ingredients,
            "matched_ingredients": self.matched_ingredients,
            "match_percentage": self.match_percentage,
        }


@dataclass(frozen=True)
class RecipeDetailDTO:
    id: int
    title: str
    description: Optional[str]
    servings: Optional[int]
    cuisine_region: Optional[str]
    meal_type: Optional[str]
    image_url: Optional[str]
    images: list[str]
    ingredients: list[RecipeIngredientDTO]
    steps: list[StepDTO]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "servings": self.servings,
            "cuisine_region": self.cuisine_region,
            "meal_type": self.meal_type,
            "image_url": self.image_url,
            "images": self.images,
            "ingredients": [i.to_dict() for i in self.ingredients],
            "steps": [s.to_dict() for s in self.steps],
        }


# --- input DTOs ---------------------------------------------------------------


@dataclass(frozen=True)
class IngredientInputDTO:
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    is_optional: bool = False
    category: str = DEFAULT_CATEGORY

    @classmethod
    def from_dict(cls, data: dict) -> "IngredientInputDTO":
        if not isinstance(data, dict):
            raise ValidationError("each ingredient must be an object")
        return cls(
            name=_req_str(data, "name", max_len=255),
            quantity=_opt_float(data.get("quantity"), field_name="quantity"),
            unit=_opt_str(data, "unit"),
            is_optional=_to_bool(data.get("is_optional")),
            category=_opt_str(data, "category") or DEFAULT_CATEGORY,
        )


@dataclass(frozen=True)
class NewRecipeDTO:
    title: str
    ingredients: list[IngredientInputDTO]
    steps: list[str]
    description: Optional[str] = None
    servings: int = DEFAULT_SERVINGS
    cuisine_region: Optional[str] = None
    meal_type: Optional[str] = None
    image_urls: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "NewRecipeDTO":
        if not isinstance(data, dict):
            raise ValidationError("recipe must be an object")

        raw_ingredients = data.get("ingredients")
        if not isinstance(raw_ingredients, list) or not raw_ingredients:
            raise ValidationError(
                "'ingredients' must be a non-empty list", details={"field": "ingredients"}
            )
        ingredients = [IngredientInputDTO.from_dict(i) for i in raw_ingredients]

        raw_steps = data.get("steps")
        if not isinstance(raw_steps, list) or not raw_steps:
            raise ValidationError(
                "'steps' must be a non-empty list", details={"field": "steps"}
            )
        steps: list[str] = []
        for step in raw_steps:
            if not isinstance(step, str) or not step.strip():
                raise ValidationError(
                    "each step must be a non-empty string", details={"field": "steps"}
                )
            steps.append(step.strip())

        # Accept both 'image_urls' (list) and a single legacy 'image_url'.
        image_urls: list[str] = []
        raw_images = data.get("image_urls")
        if isinstance(raw_images, list):
            image_urls = [str(u).strip() for u in raw_images if str(u).strip()]
        elif data.get("image_url"):
            image_urls = [str(data["image_url"]).strip()]

        return cls(
            title=_req_str(data, "title", max_len=255),
            ingredients=ingredients,
            steps=steps,
            description=_opt_str(data, "description"),
            servings=_opt_int(data.get("servings"), DEFAULT_SERVINGS, field_name="servings"),
            cuisine_region=_opt_str(data, "cuisine_region"),
            meal_type=_opt_str(data, "meal_type"),
            image_urls=image_urls,
        )
