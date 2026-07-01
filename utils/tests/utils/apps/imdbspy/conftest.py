from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _bind_imdbspy_db(imdbspy_db):
    """Bind every IMDbSpy unit test to a fresh, migrated throwaway DB (defined in
    the root conftest as ``imdbspy_db``)."""
    yield imdbspy_db
