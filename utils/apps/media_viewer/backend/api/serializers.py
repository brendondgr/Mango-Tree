from __future__ import annotations

from rest_framework import serializers

from utils.apps.media_viewer.shared.schemas import ArtifactMetadata, ArtifactRecord


class ArtifactMetadataSerializer(serializers.Serializer):
    width = serializers.IntegerField(allow_null=True, required=False)
    height = serializers.IntegerField(allow_null=True, required=False)
    duration_seconds = serializers.FloatField(allow_null=True, required=False)
    page_count = serializers.IntegerField(allow_null=True, required=False)
    language = serializers.CharField(allow_null=True, required=False)
    checksum_sha256 = serializers.CharField(allow_null=True, required=False)


class ArtifactRecordSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    filename = serializers.CharField()
    mime_type = serializers.CharField()
    kind = serializers.CharField()
    size_bytes = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    source = serializers.CharField()
    source_chat_session_id = serializers.UUIDField(allow_null=True, required=False)
    source_message_id = serializers.UUIDField(allow_null=True, required=False)
    metadata = ArtifactMetadataSerializer()

    @classmethod
    def from_record(cls, record: ArtifactRecord) -> dict:
        return cls(
            {
                "id": record.id,
                "filename": record.filename,
                "mime_type": record.mime_type,
                "kind": record.kind,
                "size_bytes": record.size_bytes,
                "created_at": record.created_at,
                "source": record.source,
                "source_chat_session_id": record.source_chat_session_id,
                "source_message_id": record.source_message_id,
                "metadata": record.metadata.to_dict(),
            },
        ).data
