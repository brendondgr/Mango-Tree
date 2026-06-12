import {
  FileText,
  Film,
  FolderOpen,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
import type { ChatMessage } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextUsageRing } from "@/features/chat/components/ContextUsageRing";
import { useContextUsage } from "@/features/chat/hooks/useContextUsage";
import { useComposerArtifactStore } from "@/features/chat/stores/composerArtifactStore";
import type {
  AttachmentKind,
  PendingAttachment,
} from "@/features/chat/types/attachment";
import { artifactToPendingAttachment } from "@/features/chat/utils/artifactToPendingAttachment";
import type { LlmUsage } from "@/services/llmTypes";
import { getArtifact } from "@/services/mediaViewerClient";
import { FILE_INPUT_ACCEPT, formatBytes } from "@/features/chat/utils/fileType";
import {
  processAttachment,
  revokeAttachmentUrls,
} from "@/features/chat/utils/processAttachment";
import { cn } from "@/lib/utils";
import { ArtifactPickerList } from "@media-viewer/components/ArtifactPickerList";
import { ArtifactSearchControls } from "@media-viewer/components/ArtifactSearchControls";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";
import {
  filterArtifacts,
  type ArtifactTypeFilter,
} from "@media-viewer/utils/filterArtifacts";

interface ChatComposerProps {
  disabled?: boolean;
  messages: ChatMessage[];
  lastKnownUsage?: LlmUsage | null;
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

export function ChatComposer({
  disabled = false,
  messages,
  lastKnownUsage = null,
  onSubmit,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const artifactQueue = useComposerArtifactStore((s) => s.queue);
  const dequeueAll = useComposerArtifactStore((s) => s.dequeueAll);
  const enqueueArtifact = useComposerArtifactStore((s) => s.enqueueArtifact);

  const [artifactQuery, setArtifactQuery] = useState("");
  const [artifactTypeFilter, setArtifactTypeFilter] =
    useState<ArtifactTypeFilter>("all");
  const { data: artifactsData } = useArtifacts();
  const filteredArtifacts = useMemo(
    () =>
      filterArtifacts(artifactsData?.results ?? [], {
        query: artifactQuery,
        typeFilter: artifactTypeFilter,
      }),
    [artifactsData?.results, artifactQuery, artifactTypeFilter],
  );

  const llmConfig = useLlmConfigStore((s) => s.config);
  const readyAttachments = attachments.filter((a) => a.status === "ready");
  const contextUsage = useContextUsage(
    messages,
    text,
    readyAttachments,
    llmConfig,
    lastKnownUsage,
  );
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

  useEffect(() => {
    if (artifactQueue.length === 0) return;

    const artifactIds = dequeueAll();

    void (async () => {
      for (const artifactId of artifactIds) {
        if (
          attachmentsRef.current.some(
            (item) => item.attachment?.artifactId === artifactId,
          )
        ) {
          continue;
        }

        let placeholderId: string | null = null;

        try {
          const artifact = await getArtifact(artifactId);
          placeholderId = crypto.randomUUID();
          setAttachments((prev) => [
            ...prev,
            {
              id: placeholderId!,
              file: new File([], artifact.filename, {
                type: artifact.mime_type,
              }),
              status: "processing",
            },
          ]);

          const pending = await artifactToPendingAttachment(artifact);
          setAttachments((prev) => {
            const withoutPlaceholder = prev.filter(
              (item) => item.id !== placeholderId,
            );
            if (
              withoutPlaceholder.some(
                (item) => item.attachment?.artifactId === artifactId,
              )
            ) {
              revokePending(pending);
              return withoutPlaceholder;
            }
            return [...withoutPlaceholder, pending];
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load artifact";
          if (placeholderId) {
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === placeholderId
                  ? { ...item, status: "error", error: message }
                  : item,
              ),
            );
          }
        }
      }
    })();
  }, [artifactQueue, dequeueAll, revokePending]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Add to message"
                disabled={disabled || isSubmitting}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-44">
              <DropdownMenuItem
                disabled={disabled || isSubmitting}
                onSelect={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Attach files
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={disabled || isSubmitting}>
                  <FolderOpen className="h-4 w-4" />
                  Artifacts
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64 p-0">
                  <div
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <ArtifactSearchControls
                      query={artifactQuery}
                      onQueryChange={setArtifactQuery}
                      typeFilter={artifactTypeFilter}
                      onTypeFilterChange={setArtifactTypeFilter}
                      variant="compact"
                    />
                    <ArtifactPickerList
                      artifacts={filteredArtifacts}
                      onAdd={enqueueArtifact}
                      variant="compact"
                    />
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
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
            className="shrink-0"
            aria-label="Send message"
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
          </Button>
          <ContextUsageRing
            usedTokens={contextUsage.usedTokens}
            maxTokens={contextUsage.maxTokens}
            percent={contextUsage.percent}
            isLoading={contextUsage.isLoading}
            isEstimated={contextUsage.isEstimated}
            label={contextUsage.label}
          />
        </div>
      </div>
    </form>
  );
}
