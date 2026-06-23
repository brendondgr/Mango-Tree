"""HTTP seams for the OAuth flow, isolated so the rest of the package is pure and
the network calls are injectable in tests.

``post_form`` does the token-endpoint exchange/refresh (form-encoded body);
``get_bearer`` reads a userinfo endpoint with the access token. Both return
``(status_code, parsed_json)``.
"""

from __future__ import annotations

from typing import Any


def post_form(url: str, data: dict[str, str]) -> tuple[int, Any]:
    import requests  # lazy: optional dependency

    resp = requests.post(url, data=data, timeout=30)
    try:
        return resp.status_code, (resp.json() if resp.content else {})
    except ValueError:
        return resp.status_code, {"raw": resp.text}


def get_bearer(url: str, access_token: str) -> tuple[int, Any]:
    import requests  # lazy: optional dependency

    resp = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
    try:
        return resp.status_code, (resp.json() if resp.content else {})
    except ValueError:
        return resp.status_code, {"raw": resp.text}
