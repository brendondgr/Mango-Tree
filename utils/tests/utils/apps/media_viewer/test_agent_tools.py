from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from utils.apps.media_viewer.agent import tools
from utils.apps.media_viewer.shared.errors import ValidationError


def test_list_artifacts_returns_structured_output() -> None:
    mock_store = MagicMock()
    mock_record = MagicMock()
    mock_record.to_dict.return_value = {"id": "a1", "filename": "x.txt"}
    mock_store.list.return_value = [mock_record]

    payload = tools.list_artifacts(store=mock_store, limit=5)
    assert "artifacts" in payload
    assert payload["artifacts"][0]["id"] == "a1"
    mock_store.list.assert_called_once_with(kind=None, limit=5)


def test_delete_artifact_without_confirm_is_denied() -> None:
    mock_store = MagicMock()
    payload = tools.delete_artifact(artifact_id="a1", confirm=False, store=mock_store)
    assert payload["error"]["code"] == "permission_denied"
    mock_store.delete.assert_not_called()


def test_delete_artifact_with_confirm_calls_service() -> None:
    mock_store = MagicMock()
    mock_store.delete.return_value = None
    payload = tools.delete_artifact(artifact_id="a1", confirm=True, store=mock_store)
    assert payload == {"deleted": True}
    mock_store.delete.assert_called_once_with("a1")


def test_save_artifact_requires_base64_content() -> None:
    mock_store = MagicMock()
    payload = tools.save_artifact(filename="x.txt", content_base64=None, store=mock_store)
    assert payload["error"]["code"] == "validation_error"
    mock_store.save.assert_not_called()


def test_save_artifact_delegates_to_service() -> None:
    mock_store = MagicMock()
    mock_record = MagicMock()
    mock_record.to_dict.return_value = {"id": "saved", "filename": "x.txt"}
    mock_store.save.return_value = mock_record

    payload = tools.save_artifact(
        filename="x.txt",
        content_base64="dGVzdA==",
        store=mock_store,
    )
    assert payload["artifact_id"] == "saved"
    mock_store.save.assert_called_once()


def test_tool_surfaces_service_validation_errors() -> None:
    mock_store = MagicMock()
    mock_store.save.side_effect = ValidationError("File exceeds maximum size")
    payload = tools.save_artifact(
        filename="x.txt",
        content_base64="dGVzdA==",
        store=mock_store,
    )
    assert payload["error"]["code"] == "validation_error"
