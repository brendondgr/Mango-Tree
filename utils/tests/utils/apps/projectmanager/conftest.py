from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _bind_projectmanager_db(projectmanager_db):
    """Bind every projectmanager unit test to the throwaway DB copy (defined in
    the root conftest as ``projectmanager_db``)."""
    yield projectmanager_db
