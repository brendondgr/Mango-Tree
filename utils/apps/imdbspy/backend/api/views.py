"""DRF views for the IMDbSpy app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Domain logic lives only in the services.
"""

from __future__ import annotations

from django.http import FileResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.imdbspy.backend.api.serializers import (
    extract_ratings,
    int_param,
    parse_object,
)
from utils.apps.imdbspy.backend.services import media as media_service
from utils.apps.imdbspy.backend.services import media_items, weights
from utils.apps.imdbspy.shared.constants import DEFAULT_LIMIT
from utils.apps.imdbspy.shared.errors import ImdbspyError

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def _error_response(exc: ImdbspyError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


# --- media items --------------------------------------------------------------

class MediaListView(APIView):
    def get(self, request: Request) -> Response:
        params = request.query_params
        result = media_items.list_media(
            status=params.get("status") or None,
            kind=params.get("kind") or None,
            search=params.get("search") or None,
            limit=int_param(params.get("limit"), DEFAULT_LIMIT),
            offset=int_param(params.get("offset"), 0),
        )
        return Response(result)


class MediaAddView(APIView):
    def post(self, request: Request) -> Response:
        try:
            data = parse_object(request.data)
            result = media_items.add_media(data.get("urls"))
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(result)


class MediaRefreshView(APIView):
    def post(self, request: Request) -> Response:
        return Response(media_items.refresh_all())


class MediaDetailView(APIView):
    def delete(self, request: Request, item_id: int) -> Response:
        try:
            media_items.delete_media(item_id)
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaStatusView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        try:
            data = parse_object(request.data)
            item = media_items.set_status(item_id, data.get("status"))
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(item.to_dict())


class MediaReviewView(APIView):
    def put(self, request: Request, item_id: int) -> Response:
        try:
            data = parse_object(request.data)
            item = media_items.update_review(
                item_id,
                scale_type=data.get("scale_type"),
                ratings=extract_ratings(data),
                user_rating=data.get("user_rating"),
                user_review=data.get("user_review"),
                seasons_seen=data.get("seasons_seen"),
            )
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(item.to_dict())


class MediaSeasonsView(APIView):
    def put(self, request: Request, item_id: int) -> Response:
        try:
            data = parse_object(request.data)
            item = media_items.update_seasons_seen(item_id, data.get("seasons_seen"))
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(item.to_dict())


# --- rating weights (API-only config surface) ---------------------------------

class WeightsView(APIView):
    def get(self, request: Request) -> Response:
        return Response([w.to_dict() for w in weights.get_weights()])

    def put(self, request: Request) -> Response:
        try:
            updated = weights.update_weights(request.data)
        except ImdbspyError as exc:
            return _error_response(exc)
        return Response(updated)


# --- media asset serving ------------------------------------------------------

class AssetView(APIView):
    def get(self, request: Request, filename: str) -> Response:
        try:
            path = media_service.resolve_asset(filename)
        except ImdbspyError as exc:
            return _error_response(exc)
        return FileResponse(path.open("rb"))
