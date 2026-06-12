from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils.apps.media_viewer.shared.config import load_artifacts_config


def _events_log_path() -> Path:
    return load_artifacts_config().root / "events.jsonl"


def emit_trace_event(
    *,
    action: str,
    artifact_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Append a lightweight local trace entry for artifact operations."""
    entry = {
        "timestamp": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "action": action,
        "artifact_id": artifact_id,
        "details": details or {},
    }
    path = _events_log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, sort_keys=True))
        handle.write("\n")
