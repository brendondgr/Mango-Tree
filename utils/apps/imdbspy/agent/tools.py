"""IMDbSpy agent tools.

Thin wrappers over ``backend/services/`` that call the same functions the DRF
views call (API <-> agent parity), returning structured ``ToolResult`` output.

Populated in Stage 6.
"""

from __future__ import annotations
