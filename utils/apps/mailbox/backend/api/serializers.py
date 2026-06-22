"""Thin (de)serialization helpers for the mailbox API.

``AccountConfig`` already defines its schema (``from_dict``/``to_dict``), so the
API layer only guards request bodies, wraps lists in the platform envelope, and
adds a derived ``has_credential`` flag (the secret value is never serialized).
"""

from __future__ import annotations

from typing import Any

from utils.apps.mailbox.backend.services import secrets
from utils.apps.mailbox.shared.errors import ValidationError
from utils.apps.mailbox.shared.schemas import AccountConfig

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 500


def parse_object(data: Any) -> dict:
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    return data


def serialize_account(account: AccountConfig) -> dict[str, Any]:
    """Public account shape: settings + a derived ``has_credential`` flag. The
    ``credential_ref`` is a key name (safe); the secret value is never included."""
    data = account.to_dict()
    data["has_credential"] = secrets.has_credential(account.credential_ref)
    return data


def _int_param(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def paginate(request, items: list[dict]) -> dict:
    page = max(_int_param(request.query_params.get("page"), 1), 1)
    page_size = _int_param(request.query_params.get("page_size"), DEFAULT_PAGE_SIZE)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "count": total,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": items[start:end],
    }
