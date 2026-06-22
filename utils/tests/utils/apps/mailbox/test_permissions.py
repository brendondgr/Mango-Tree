"""Stage 10 verification: the mailbox access guarantees are declared in code.

Network scope allow-lists the mail hosts (and Microsoft Graph); filesystem scope
confines the config/secret stores to data/mailbox/** and denies the platform
.env and config/. Out-of-scope hosts and paths are not in scope.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from django.conf import settings


def _config() -> dict:
    return yaml.safe_load((Path(settings.BASE_DIR) / "config" / "permissions.yaml").read_text())


# --- network scope ------------------------------------------------------------

def test_mail_hosts_are_allow_listed():
    scope = _config()["network"]["mailbox_imap_smtp"]
    hosts = set(scope["allow_hosts"])
    required = {
        "imap.gmail.com", "smtp.gmail.com",
        "outlook.office365.com", "smtp.office365.com",
        "imap.mail.yahoo.com", "smtp.mail.yahoo.com",
    }
    assert required <= hosts
    assert "imaps" in scope["allow_schemes"]


def test_graph_host_is_allow_listed():
    scope = _config()["network"]["mailbox_graph"]
    assert "graph.microsoft.com" in scope["allow_hosts"]
    assert "https" in scope["allow_schemes"]


def test_out_of_scope_host_is_not_allowed():
    config = _config()
    all_hosts = set(config["network"]["mailbox_imap_smtp"]["allow_hosts"]) | set(
        config["network"]["mailbox_graph"]["allow_hosts"]
    )
    assert "imap.evil.example" not in all_hosts
    assert "attacker.com" not in all_hosts


# --- filesystem scope ---------------------------------------------------------

def test_config_path_is_in_scope():
    config = _config()
    scope = config["filesystem"]["mailbox_config"]
    assert scope["allow"] == [f"{{mailbox_root}}/**"]
    assert config["mailbox_root"] == "data/mailbox"


def test_out_of_scope_paths_are_denied():
    scope = _config()["filesystem"]["mailbox_config"]
    deny = set(scope["deny"])
    assert "config/**" in deny       # cannot reach the platform config
    assert "**/.env" in deny         # cannot reach the platform secrets
    assert "../**" in deny           # cannot escape the data root
