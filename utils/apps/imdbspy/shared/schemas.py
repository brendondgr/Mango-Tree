"""Lightweight DTO / serialization helpers shared by the API and agent layers.

Model instances expose ``to_dict()`` (see ``backend/models/``) which is the
single source of truth for the serialized shape. This module holds the small
input DTOs used to parse request/tool payloads before they reach a service.

Populated in Stage 4 (service extraction).
"""

from __future__ import annotations
