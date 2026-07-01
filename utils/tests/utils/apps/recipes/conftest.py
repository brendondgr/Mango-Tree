from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _bind_recipes_db(recipes_db):
    """Bind every recipes unit test to the seeded throwaway DB copy (defined in
    the root conftest as ``recipes_db``)."""
    yield recipes_db
