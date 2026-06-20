from __future__ import annotations

from pathlib import Path

from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore
from utils.apps.media_viewer.shared.config import ArtifactsConfig
from utils.shared.events.trace import emit_trace_event


def test_emit_trace_event_appends_jsonl(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    config = ArtifactsConfig(
        root=root,
        max_file_size_bytes=20 * 1024 * 1024,
        max_image_size_bytes=5 * 1024 * 1024,
        max_pdf_size_bytes=10 * 1024 * 1024,
        allowed_kinds=frozenset({"text"}),
    )
    import utils.shared.events.trace as trace_module

    original = trace_module.load_artifacts_config
    trace_module.load_artifacts_config = lambda: config
    try:
        emit_trace_event(
            action="artifact_saved",
            artifact_id="abc-123",
            details={"filename": "test.txt"},
        )
    finally:
        trace_module.load_artifacts_config = original

    log_path = root / "events.jsonl"
    assert log_path.is_file()
    line = log_path.read_text(encoding="utf-8").strip()
    assert "artifact_saved" in line
    assert "abc-123" in line


def test_save_emits_trace_event(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    config = ArtifactsConfig(
        root=root,
        max_file_size_bytes=20 * 1024 * 1024,
        max_image_size_bytes=5 * 1024 * 1024,
        max_pdf_size_bytes=10 * 1024 * 1024,
        allowed_kinds=frozenset({"text"}),
    )
    import utils.shared.events.trace as trace_module

    original = trace_module.load_artifacts_config
    trace_module.load_artifacts_config = lambda: config
    try:
        store = ArtifactStore(config)
        record = store.save(filename="note.txt", data=b"hello", mime_type="text/plain")
    finally:
        trace_module.load_artifacts_config = original

    log_path = root / "events.jsonl"
    assert log_path.is_file()
    assert record.id in log_path.read_text(encoding="utf-8")
