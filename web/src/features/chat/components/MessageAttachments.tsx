import {
  ChevronDown,
  ChevronRight,
  FileText,
  Film,
  ImageIcon,
} from "lucide-react";
import { useState } from "react";

import { MessageImageLightbox } from "@/features/chat/components/MessageImageLightbox";
import { MessageImageStrip } from "@/features/chat/components/MessageImageStrip";
import type { ChatAttachment } from "@/features/chat/types/attachment";
import { formatBytes } from "@/features/chat/utils/fileType";
import { cn } from "@/lib/utils";

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  variant?: "user" | "agent";
}

const PREVIEW_LINES = 20;

function AttachmentKindIcon({ kind }: { kind: ChatAttachment["kind"] }) {
  switch (kind) {
    case "image":
      return <ImageIcon className="h-3.5 w-3.5" />;
    case "video":
      return <Film className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
}

function TextAttachmentCard({
  attachment,
  variant,
}: {
  attachment: ChatAttachment;
  variant: "user" | "agent";
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = attachment.textContent?.split("\n") ?? [];
  const hasMore = lines.length > PREVIEW_LINES;
  const preview = expanded
    ? attachment.textContent
    : lines.slice(0, PREVIEW_LINES).join("\n");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border text-left",
        variant === "user"
          ? "border-primary-foreground/20 bg-primary-foreground/10"
          : "border-border/60 bg-muted/30",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs"
        onClick={() => hasMore && setExpanded((v) => !v)}
      >
        <AttachmentKindIcon kind={attachment.kind} />
        <span className="min-w-0 flex-1 truncate font-medium">
          {attachment.name}
        </span>
        {attachment.language && (
          <span className="shrink-0 rounded bg-background/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
            {attachment.language}
          </span>
        )}
        <span className="shrink-0 text-[10px] opacity-70">
          {formatBytes(attachment.size)}
        </span>
        {hasMore &&
          (expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ))}
      </button>
      {preview && (
        <pre className="max-h-48 overflow-auto border-t border-inherit px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap opacity-90">
          {preview}
          {!expanded && hasMore ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}

function ErrorAttachmentChip({
  attachment,
  variant,
}: {
  attachment: ChatAttachment;
  variant: "user" | "agent";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
        variant === "user"
          ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="truncate font-medium">{attachment.name}</p>
        <p className="text-[10px] opacity-90">{attachment.error}</p>
      </div>
    </div>
  );
}

function isImageAttachment(attachment: ChatAttachment): boolean {
  return (
    !attachment.error &&
    attachment.kind === "image" &&
    Boolean(attachment.previewUrl)
  );
}

export function MessageAttachments({
  attachments,
  variant = "user",
}: MessageAttachmentsProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (attachments.length === 0) return null;

  const imageAttachments = attachments.filter(isImageAttachment);
  const otherAttachments = attachments.filter(
    (attachment) => !isImageAttachment(attachment),
  );

  return (
    <div className="mb-2 flex w-full flex-col gap-2">
      {imageAttachments.length > 0 && (
        <>
          <MessageImageStrip
            images={imageAttachments}
            variant={variant}
            onImageClick={(index) => {
              setLightboxIndex(index);
              setLightboxOpen(true);
            }}
          />
          <MessageImageLightbox
            images={imageAttachments}
            open={lightboxOpen}
            initialIndex={lightboxIndex}
            onOpenChange={setLightboxOpen}
          />
        </>
      )}

      {otherAttachments.map((attachment) => {
        if (attachment.error) {
          return (
            <ErrorAttachmentChip
              key={attachment.id}
              attachment={attachment}
              variant={variant}
            />
          );
        }

        if (attachment.kind === "video" && attachment.previewUrl) {
          return (
            <video
              key={attachment.id}
              src={attachment.previewUrl}
              controls
              className="max-h-48 w-full max-w-full rounded-md"
            />
          );
        }

        if (
          (attachment.kind === "text" || attachment.kind === "pdf") &&
          attachment.textContent
        ) {
          return (
            <TextAttachmentCard
              key={attachment.id}
              attachment={attachment}
              variant={variant}
            />
          );
        }

        return (
          <div
            key={attachment.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
              variant === "user"
                ? "border-primary-foreground/20 bg-primary-foreground/10"
                : "border-border/60 bg-muted/30",
            )}
          >
            <AttachmentKindIcon kind={attachment.kind} />
            <span className="truncate font-medium">{attachment.name}</span>
            <span className="text-[10px] opacity-70">
              {formatBytes(attachment.size)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
