from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore
from utils.apps.media_viewer.shared.errors import ArtifactError


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _artifact_payload(record) -> dict[str, Any]:
    return record.to_dict()


def _handle_service_call(action: Callable[[], Any]) -> ToolResult:
    try:
        result = action()
        if isinstance(result, list):
            return ToolResult(ok=True, data={"artifacts": [_artifact_payload(item) for item in result]})
        if hasattr(result, "to_dict"):
            return ToolResult(ok=True, data={"artifact": _artifact_payload(result)})
        return ToolResult(ok=True, data={"result": result})
    except ArtifactError as exc:
        return ToolResult(
            ok=False,
            data={},
            error={"code": exc.code, "message": exc.message, "details": exc.details},
        )


def list_artifacts(
    *,
    kind: str | None = None,
    limit: int | None = None,
    store: ArtifactStore | None = None,
) -> dict[str, Any]:
    artifact_store = store or ArtifactStore()
    result = _handle_service_call(
        lambda: artifact_store.list(kind=kind, limit=limit),
    )
    return result.to_dict()


def get_artifact(*, artifact_id: str, store: ArtifactStore | None = None) -> dict[str, Any]:
    artifact_store = store or ArtifactStore()
    result = _handle_service_call(lambda: artifact_store.get(artifact_id))
    return result.to_dict()


def save_artifact(
    *,
    filename: str,
    content_base64: str | None = None,
    mime_type: str = "application/octet-stream",
    source: str = "agent",
    store: ArtifactStore | None = None,
) -> dict[str, Any]:
    import base64

    if not content_base64:
        return ToolResult(
            ok=False,
            data={},
            error={
                "code": "validation_error",
                "message": "content_base64 is required",
                "details": {},
            },
        ).to_dict()

    try:
        data = base64.b64decode(content_base64, validate=True)
    except Exception:
        return ToolResult(
            ok=False,
            data={},
            error={
                "code": "validation_error",
                "message": "content_base64 must be valid base64",
                "details": {},
            },
        ).to_dict()

    artifact_store = store or ArtifactStore()
    result = _handle_service_call(
        lambda: artifact_store.save(
            filename=filename,
            data=data,
            mime_type=mime_type,
            source=source if source in {"agent", "manual", "chat_upload"} else "agent",
        ),
    )
    if result.ok:
        return {
            "artifact_id": result.data["artifact"]["id"],
            **result.data,
        }
    return result.to_dict()


def delete_artifact(
    *,
    artifact_id: str,
    confirm: bool = False,
    store: ArtifactStore | None = None,
) -> dict[str, Any]:
    if confirm is not True:
        return ToolResult(
            ok=False,
            data={},
            error={
                "code": "permission_denied",
                "message": "Deletion requires confirm: true",
                "details": {},
            },
        ).to_dict()

    artifact_store = store or ArtifactStore()
    result = _handle_service_call(lambda: artifact_store.delete(artifact_id) or {"deleted": True})
    if result.ok:
        return {"deleted": True}
    return result.to_dict()
