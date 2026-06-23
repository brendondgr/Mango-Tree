"""PKCE + state helpers.

PKCE proves the app redeeming the code is the one that started the flow; ``state``
ties the callback to a specific attempt and blocks CSRF. All values are
URL-safe base64 without padding.
"""

from __future__ import annotations

import base64
import hashlib
import os


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def new_verifier() -> str:
    """A high-entropy code verifier (43–128 chars after encoding)."""
    return _b64url(os.urandom(64))


def challenge_for(verifier: str) -> str:
    """The S256 code challenge for a verifier."""
    return _b64url(hashlib.sha256(verifier.encode()).digest())


def new_state() -> str:
    return _b64url(os.urandom(24))
