from __future__ import annotations

from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.media_viewer.backend.api.serializers import ArtifactRecordSerializer
from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore
from utils.apps.media_viewer.backend.services.classification import classify_file
from utils.apps.media_viewer.backend.services.thumbnails import build_thumbnail_for_upload
from utils.apps.media_viewer.shared.constants import DEFAULT_PAGE_SIZE
from utils.apps.media_viewer.shared.errors import ArtifactError


def _error_response(exc: ArtifactError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status={
            "validation_error": status.HTTP_400_BAD_REQUEST,
            "permission_denied": status.HTTP_403_FORBIDDEN,
            "not_found": status.HTTP_404_NOT_FOUND,
            "conflict": status.HTTP_409_CONFLICT,
        }.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


class ArtifactListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request: Request) -> Response:
        store = ArtifactStore()
        kind = request.query_params.get("kind")
        try:
            limit = int(request.query_params.get("limit", DEFAULT_PAGE_SIZE))
        except ValueError:
            limit = DEFAULT_PAGE_SIZE

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
        except ValueError:
            page = 1
        artifacts = store.list(kind=kind)
        start = (page - 1) * limit
        end = start + limit
        page_items = artifacts[start:end]

        return Response(
            {
                "count": len(artifacts),
                "next": page + 1 if end < len(artifacts) else None,
                "previous": page - 1 if page > 1 else None,
                "results": [
                    ArtifactRecordSerializer.from_record(item) for item in page_items
                ],
            },
        )

    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {
                    "code": "validation_error",
                    "message": "file is required",
                    "details": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = upload.read()
        filename = upload.name or "upload.bin"
        mime_type = upload.content_type or "application/octet-stream"
        source = request.data.get("source", "manual")
        if source not in {"chat_upload", "agent", "manual"}:
            source = "manual"

        poster = request.FILES.get("poster")
        poster_data = poster.read() if poster else None
        kind = classify_file(filename=filename, mime_type=mime_type)
        thumbnail_data = build_thumbnail_for_upload(
            kind=kind,
            data=data,
            poster_data=poster_data,
        )

        store = ArtifactStore()
        try:
            record = store.save(
                filename=filename,
                data=data,
                mime_type=mime_type,
                source=source,
                source_chat_session_id=request.data.get("source_chat_session_id"),
                source_message_id=request.data.get("source_message_id"),
                thumbnail_data=thumbnail_data,
            )
        except ArtifactError as exc:
            return _error_response(exc)

        return Response(
            ArtifactRecordSerializer.from_record(record),
            status=status.HTTP_201_CREATED,
        )


class ArtifactDetailView(APIView):
    def get(self, request: Request, artifact_id) -> Response:
        store = ArtifactStore()
        try:
            record = store.get(str(artifact_id))
        except ArtifactError as exc:
            return _error_response(exc)
        return Response(ArtifactRecordSerializer.from_record(record))

    def delete(self, request: Request, artifact_id) -> Response:
        store = ArtifactStore()
        try:
            store.delete(str(artifact_id))
        except ArtifactError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArtifactContentView(APIView):
    def get(self, request: Request, artifact_id) -> Response | HttpResponse:
        store = ArtifactStore()
        try:
            record, data = store.read_content(str(artifact_id))
        except ArtifactError as exc:
            return _error_response(exc)

        disposition = request.query_params.get("disposition", "inline")
        if disposition not in {"inline", "attachment"}:
            disposition = "inline"

        response = HttpResponse(data, content_type=record.mime_type)
        response["Content-Disposition"] = f'{disposition}; filename="{record.filename}"'
        return response


class ArtifactThumbnailView(APIView):
    def get(self, request: Request, artifact_id) -> Response | HttpResponse:
        store = ArtifactStore()
        try:
            record, data = store.read_thumbnail(str(artifact_id))
        except ArtifactError as exc:
            return _error_response(exc)

        response = HttpResponse(data, content_type="image/webp")
        response["Content-Disposition"] = f'inline; filename="{record.id}.webp"'
        return response
