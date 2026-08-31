"""DRF views for the LLM provider API, mounted at ``/api/llm/``.

Thin: parse -> service -> serialize. Everything here inherits the global
``IsAuthenticated`` default, so an unauthenticated request is refused before it
can enumerate endpoints or trigger an outbound call.

Two rules this module exists to enforce:

1. **The browser never talks to a model endpoint.** It used to: model discovery,
   the connection test and token counting all called the configured base URL
   directly, which only worked because the Vite dev proxy forwarded ``/v1``.
   Point that at ``api.anthropic.com`` and the preflight is refused, so the UI
   would report "unreachable" for a provider that works perfectly server-side.
2. **An API key is written, never read.** No response body from this module
   contains a key — only a masked hint, enough to tell two keys apart when
   rotating one.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from utils.shared.llm.services import providers as providers_service
from utils.shared.llm.services import registry

_STATUS_FOR_KIND = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "conflict": status.HTTP_409_CONFLICT,
    "not_found": status.HTTP_404_NOT_FOUND,
}


def _error(exc: providers_service.ProviderError) -> Response:
    body: dict = {"error": exc.kind, "detail": exc.message}
    if exc.field:
        body["field"] = exc.field
    return Response(body, status=_STATUS_FOR_KIND.get(exc.kind, status.HTTP_400_BAD_REQUEST))


def _payload(data) -> dict:
    return data if isinstance(data, dict) else {}


@api_view(["GET"])
def kinds(request: Request) -> Response:
    """The adapter kinds the Add-provider form can offer."""
    return Response(
        {
            "kinds": [
                {
                    "id": kind,
                    "label": label,
                    "needs_key": kind in registry.HOSTED_KINDS,
                    "needs_base_url": kind not in registry.HOSTED_KINDS,
                }
                for kind, label in sorted(registry.KNOWN_KINDS.items(), key=lambda kv: kv[1])
            ]
        }
    )


@api_view(["GET", "POST"])
def provider_collection(request: Request) -> Response:
    if request.method == "POST":
        try:
            provider = providers_service.create_provider(_payload(request.data))
        except providers_service.ProviderError as exc:
            return _error(exc)
        return Response(provider.to_dict(), status=status.HTTP_201_CREATED)

    return Response(
        {
            "providers": [entry.to_dict() for entry in registry.list_providers()],
            "default_provider": registry.default_provider_slug(),
        }
    )


@api_view(["PATCH", "DELETE"])
def provider_detail(request: Request, slug: str) -> Response:
    try:
        if request.method == "DELETE":
            providers_service.delete_provider(slug)
            return Response(status=status.HTTP_204_NO_CONTENT)
        provider = providers_service.update_provider(slug, _payload(request.data))
    except providers_service.ProviderError as exc:
        return _error(exc)
    return Response(provider.to_dict())


@api_view(["GET"])
def models(request: Request) -> Response:
    """Live model discovery for one provider.

    Returns **200 with ``ok: false``** when the endpoint cannot be reached. An
    unreachable local server is a normal state, not a server error: someone's
    GPU box being switched off should render as a message beside the dropdown,
    not as a failed request.
    """
    slug = request.query_params.get("provider") or registry.default_provider_slug()
    if not slug:
        return Response(
            {"ok": False, "error_kind": "no_provider", "error": "No provider is configured.", "models": []}
        )

    entry = registry.get_provider(slug)
    if entry is None:
        return Response(
            {"error": "not_found", "detail": f"No provider '{slug}'."},
            status=status.HTTP_404_NOT_FOUND,
        )

    refresh = request.query_params.get("refresh") in {"1", "true", "yes"}
    return Response(registry.discover_models(entry, refresh=refresh))


@api_view(["POST"])
def test(request: Request) -> Response:
    """Reachability plus a real one-token generation.

    Listing models proves the endpoint answers; it does not prove the key is
    accepted for generation, which is the failure that actually matters. Both
    are reported separately.
    """
    payload = _payload(request.data)
    slug = payload.get("provider") or registry.default_provider_slug()
    if not slug:
        return Response(
            {"error": "validation_error", "detail": "No provider is configured."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        return Response(providers_service.test_provider(slug, payload.get("model")))
    except providers_service.ProviderError as exc:
        return _error(exc)
