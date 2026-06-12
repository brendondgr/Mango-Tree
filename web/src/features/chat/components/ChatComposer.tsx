import {
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  AttachmentKind,
  PendingAttachment,
} from "@/features/chat/types/attachment";
import { FILE_INPUT_ACCEPT, formatBytes } from "@/features/chat/utils/fileType";
import {
  processAttachment,
  revokeAttachmentUrls,
} from "@/features/chat/utils/processAttachment";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  disabled?: boolean;
  onSubmit: (
    text: string,
    attachments: PendingAttachment[],
  ) => void | Promise<void>;
}

function AttachmentIcon({ kind }: { kind?: AttachmentKind }) {
  switch (kind) {
    case "image":
      return <ImageIcon className="h-3.5 w-3.5 shrink-0" />;
    case "video":
      return <Film className="h-3.5 w-3.5 shrink-0" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0" />;
  }
}

export function ChatComposer({ disabled = false, onSubmit }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const readyAttachments = attachments.filter((a) => a.status === "ready");
  const hasProcessing = attachments.some((a) => a.status === "processing");
  const canSend =
    !disabled &&
    !isSubmitting &&
    !hasProcessing &&
    (text.trim().length > 0 || readyAttachments.length > 0);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  const revokePending = useCallback((pending: PendingAttachment) => {
    if (pending.attachment) {
      revokeAttachmentUrls(pending.attachment);
    }
  }, []);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(revokePending);
    };
  }, [revokePending]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const pendingItems: PendingAttachment[] = fileArray.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "processing" as const,
    }));

    setAttachments((prev) => [...prev, ...pendingItems]);

    await Promise.all(
      pendingItems.map(async (pending) => {
        try {
          const attachment = await processAttachment(pending.file);
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === pending.id
                ? { ...item, status: "ready", attachment }
                : item,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to process file";
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === pending.id
                ? { ...item, status: "error", error: message }
                : item,
            ),
          );
        }
      }),
    );
  }, []);

  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const item = prev.find((entry) => entry.id === id);
        if (item) revokePending(item);
        return prev.filter((entry) => entry.id !== id);
      });
    },
    [revokePending],
  );

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach(revokePending);
      return [];
    });
  }, [revokePending]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;

    setIsSubmitting(true);
    try {
      const ready = attachments.filter((a) => a.status === "ready");
      await onSubmit(text.trim(), ready);
      setText("");
      clearAttachments();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      void addFiles(imageFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isSubmitting) return;
    if (e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border border-border bg-background transition-shadow focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15",
          isDragging && "border-primary ring-[3px] ring-primary/15",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-border/60 px-3 py-2">
            {attachments.map((pending) => {
              const attachment = pending.attachment;
              const isError = pending.status === "error";
              const isProcessing = pending.status === "processing";

              return (
                <div
                  key={pending.id}
                  className={cn(
                    "group relative flex max-w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    isError
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-border bg-muted/40 text-foreground",
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : attachment?.kind === "image" && attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                  ) : attachment?.kind === "video" && attachment.previewUrl ? (
                    <video
                      src={attachment.previewUrl}
                      className="h-8 w-12 shrink-0 rounded object-cover"
                      muted
                    />
                  ) : (
                    <AttachmentIcon kind={attachment?.kind} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{pending.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isError
                        ? pending.error
                        : isProcessing
                          ? "Processing…"
                          : formatBytes(pending.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${pending.file.name}`}
                    onClick={() => removeAttachment(pending.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            className="sr-only"
            disabled={disabled || isSubmitting}
            onChange={(e) => {
              if (e.target.files) {
                void addFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Attach files"
            disabled={disabled || isSubmitting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message…"
            autoComplete="off"
            disabled={disabled || isSubmitting}
            rows={1}
            className="max-h-40 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-snug outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            aria-label="Send message"
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
