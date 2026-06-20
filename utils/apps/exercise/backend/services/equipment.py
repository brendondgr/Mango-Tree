"""Equipment domain logic. ``is_bodyweight`` is stored as INTEGER (0/1) in the
legacy table and exposed as a boolean DTO field."""

from __future__ import annotations

from dataclasses import replace

from utils.apps.exercise.backend.models import Equipment
from utils.apps.exercise.shared.errors import ConflictError, NotFoundError
from utils.apps.exercise.shared.schemas import EquipmentDTO


def _to_dto(row: Equipment) -> EquipmentDTO:
    return EquipmentDTO(
        id=row.id,
        name=row.name,
        type=row.type,
        weight=row.weight,
        min_weight=row.min_weight,
        max_weight=row.max_weight,
        unit=row.unit or "lbs",
        is_bodyweight=bool(row.is_bodyweight),
        color=row.color,
    )


def list_equipment() -> list[EquipmentDTO]:
    return [_to_dto(row) for row in Equipment.objects.all()]


def add_equipment(equip: EquipmentDTO) -> EquipmentDTO:
    if Equipment.objects.filter(id=equip.id).exists():
        raise ConflictError(
            f"Equipment {equip.id} already exists", details={"id": equip.id}
        )
    Equipment.objects.create(
        id=equip.id,
        name=equip.name,
        type=equip.type,
        weight=equip.weight,
        min_weight=equip.min_weight,
        max_weight=equip.max_weight,
        unit=equip.unit,
        is_bodyweight=int(equip.is_bodyweight),
        color=equip.color,
    )
    return equip


def update_equipment(equip_id: str, equip: EquipmentDTO) -> EquipmentDTO:
    updated = Equipment.objects.filter(id=equip_id).update(
        name=equip.name,
        type=equip.type,
        weight=equip.weight,
        min_weight=equip.min_weight,
        max_weight=equip.max_weight,
        unit=equip.unit,
        is_bodyweight=int(equip.is_bodyweight),
        color=equip.color,
    )
    if not updated:
        raise NotFoundError(
            f"Equipment {equip_id} not found", details={"id": equip_id}
        )
    return replace(equip, id=equip_id)


def delete_equipment(equip_id: str) -> None:
    deleted, _ = Equipment.objects.filter(id=equip_id).delete()
    if not deleted:
        raise NotFoundError(
            f"Equipment {equip_id} not found", details={"id": equip_id}
        )
