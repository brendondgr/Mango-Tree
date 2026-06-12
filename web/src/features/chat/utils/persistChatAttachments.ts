import type { PendingAttachment } from "@/features/chat/types/attachment";
import { uploadArtifact } from "@/services/mediaViewerClient";

export interface PersistedAttachmentResult {
  attachmentId: string;
  artifactId: string;
}

export async function persistChatAttachments(
  pendingAttachments: PendingAttachment[],
  context: {
    chatSessionId: string;
    messageId: string;
  },
): Promise<PersistedAttachmentResult[]> {
  const ready = pendingAttachments.filter(
    (item) => item.status === "ready" && item.attachment && !item.attachment.error,
  );

  const results: PersistedAttachmentResult[] = [];

  await Promise.all(
    ready.map(async (item) => {
      const record = await uploadArtifact(item.file, {
        source: "chat_upload",
        source_chat_session_id: context.chatSessionId,
        source_message_id: context.messageId,
      });
      results.push({
        attachmentId: item.attachment!.id,
        artifactId: record.id,
      });
    }),
  );

  return results;
}
