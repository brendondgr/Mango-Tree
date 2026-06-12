import type { PendingAttachment } from "@/features/chat/types/attachment";
import { processAttachment } from "@/features/chat/utils/processAttachment";
import {
  artifactThumbnailUrl,
  fetchArtifactBlob,
} from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

export async function artifactToPendingAttachment(
  artifact: ArtifactRecord,
): Promise<PendingAttachment> {
  const blob = await fetchArtifactBlob(artifact.id);
  const file = new File([blob], artifact.filename, {
    type: artifact.mime_type || blob.type || "application/octet-stream",
  });

  const attachment = await processAttachment(file);
  attachment.artifactId = artifact.id;

  if (artifact.kind === "image" || artifact.kind === "video") {
    attachment.previewUrl = artifactThumbnailUrl(artifact.id);
  }

  return {
    id: crypto.randomUUID(),
    file,
    status: "ready",
    attachment,
  };
}
