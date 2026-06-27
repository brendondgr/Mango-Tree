"""Stage 6 verification: the calendar filesystem scope is declared in code.

The JSON store is confined to ``data/calendar/**``; the platform ``.env`` and
``config/`` are denied, and the data root cannot be escaped.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from django.conf import settings


def _config() -> dict:
    return yaml.safe_load(
        (Path(settings.BASE_DIR) / "config" / "permissions.yaml").read_text()
    )


def test_calendar_data_path_is_in_scope():
    config = _config()
    scope = config["filesystem"]["calendar_data"]
    assert scope["allow"] == ["{calendar_root}/**"]
    assert config["calendar_root"] == "data/calendar"


def test_out_of_scope_paths_are_denied():
    deny = set(_config()["filesystem"]["calendar_data"]["deny"])
    assert "config/**" in deny     # cannot reach the platform config
    assert "**/.env" in deny       # cannot reach the platform secrets
    assert "../**" in deny         # cannot escape the data root
