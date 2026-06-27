"""Category domain logic. Single source of truth for both the DRF API and the
agent tools."""

from __future__ import annotations

from utils.apps.projectmanager.backend.models import Category
from utils.apps.projectmanager.shared.schemas import CategoryDTO


def _to_dto(row: Category) -> CategoryDTO:
    return CategoryDTO(id=row.id, name=row.name, color=row.color)


def list_categories() -> list[CategoryDTO]:
    return [_to_dto(row) for row in Category.objects.all().order_by("name")]


def resolve_or_create(name: str, color: str) -> Category:
    """Find a category by name, updating its colour globally if changed, or
    create it. Mirrors the legacy create/edit-project category logic."""
    category = Category.objects.filter(name=name).first()
    if category is not None:
        if category.color != color:
            category.color = color
            category.save(update_fields=["color"])
        return category
    return Category.objects.create(name=name, color=color)
