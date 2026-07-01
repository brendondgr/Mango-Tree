from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _bind_timekeeper_db(timekeeper_db):
    """Bind every timekeeper unit test to the throwaway DB copy (defined in the
    root conftest as ``timekeeper_db``)."""
    yield timekeeper_db
