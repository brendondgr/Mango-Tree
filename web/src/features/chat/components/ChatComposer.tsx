import {
  FolderOpen,
  Globe,
  Paperclip,
  Plus,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
import type { ChatMessage } from "@/app/stores/workspaceStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposerAttachmentPill } from "@/features/chat/components/ComposerAttachmentPill";
import { ComposerAttachmentStrip } from "@/features/chat/components/ComposerAttachmentStrip";
import { ContextUsageRing } from "@/features/chat/components/ContextUsageRing";
import { SlashCommandMenu } from "@/features/chat/components/SlashCommandMenu";
import { ToolGroupsPopover } from "@/features/chat/components/ToolGroupsPopover";
import {
  getSlashSuggestions,
  resolveSlashCommand,
  type SlashAction,
} from "@/features/chat/utils/slashCommands";
import { useContextUsage } from "@/features/chat/hooks/useContextUsage";
import { useComposerArtifactStore } from "@/features/chat/stores/composerArtifactStore";
import { useComposerDraftStore } from "@/features/chat/stores/composerDraftStore";
import { useComposerWebSearchStore } from "@/features/chat/stores/composerWebSearchStore";
import type { PendingAttachment } from "@/features/chat/types/attachment";
import { artifactToPendingAttachment } from "@/features/chat/utils/artifactToPendingAttachment";
import type { LlmUsage } from "@/services/llmTypes";
import { getArtifact } from "@/services/mediaViewerClient";
import { FILE_INPUT_ACCEPT } from "@/features/chat/utils/fileType";
import {
  processAttachment,
  revokeAttachmentUrls,
} from "@/features/chat/utils/processAttachment";
import { cn } from "@/lib/utils";
import { ArtifactPickerList } from "@media-viewer/components/ArtifactPickerList";
import { ArtifactSearchControls } from "@media-viewer/components/ArtifactSearchControls";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";
import {
  artifactsForPicker,
  type ArtifactTypeFilter,
} from "@media-viewer/utils/filterArtifacts";

interface ChatComposerProps {
  disabled?: boolean;
  messages: ChatMessage[];
  lastKnownUsage?: LlmUsage | null;
  onSubmit: (
    text: string,
    attachments: PendingAttachment[],
    options?: { webSearchMode?: "auto" | "forced" },
  ) => void | Promise<void>;
}

export function ChatComposer({
  disabled = false,
  messages,
  lastKnownUsage = null,
  onSubmit,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const pendingDraft = useComposerDraftStore((state) => state.pending);
  const consumeDraft = useComposerDraftStore((state) => state.consume);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const artifactQueue = useComposerArtifactStore((s) => s.queue);
  const dequeueAll = useComposerArtifactStore((s) => s.dequeueAll);
  const enqueueArtifact = useComposerArtifactStore((s) => s.enqueueArtifact);
  const webSearchEnabled = useComposerWebSearchStore((s) => s.enabled);
  const setWebSearchEnabled = useComposerWebSearchStore((s) => s.setEnabled);

  const [artifactQuery, setArtifactQuery] = useState("");
  const [artifactTypeFilter, setArtifactTypeFilter] =
    useState<ArtifactTypeFilter>("all");
  const { data: artifactsData } = useArtifacts();
  const filteredArtifacts = useMemo(
    () =>
      artifactsForPicker(artifactsData?.results ?? [], {
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

  // --- slash commands (/tools, /enable, /disable) --------------------------
  const toolGroupCatalogue = useWorkspaceStore((s) => s.toolGroupCatalogue);
  const enabledToolGroups = useWorkspaceStore((s) => s.enabledToolGroups);
  const setToolGroupEnabled = useWorkspaceStore((s) => s.setToolGroupEnabled);
  const setToolGroupsPopoverOpen = useWorkspaceStore(
    (s) => s.setToolGroupsPopoverOpen,
  );
  const setToolSelectionMode = useWorkspaceStore((s) => s.setToolSelectionMode);

  const slashItems = useMemo(
    () => getSlashSuggestions(text, toolGroupCatalogue, enabledToolGroups),
    [text, toolGroupCatalogue, enabledToolGroups],
  );
  const slashMenuOpen = !slashDismissed && slashItems.length > 0;

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [text]);

  const executeSlash = useCallback(
    (action: SlashAction) => {
      if (action.kind === "tools") {
        setToolGroupsPopoverOpen(true);
      } else if (action.kind === "mode") {
        setToolSelectionMode(action.mode);
      } else {
        setToolGroupEnabled(action.group, action.kind === "enable");
      }
      setText("");
      setSlashDismissed(false);
    },
    [setToolGroupEnabled, setToolGroupsPopoverOpen, setToolSelectionMode],
  );

  const pickSlashSuggestion = useCallback(
    (insert: string) => {
      const action = resolveSlashCommand(insert, toolGroupCatalogue, enabledToolGroups);
      if (action) {
        executeSlash(action);
      } else {
        setText(insert);
      }
      textareaRef.current?.focus();
    },
    [toolGroupCatalogue, enabledToolGroups, executeSlash],
  );

  useEffect(() => {
    if (pendingDraft === null) return;
    const draft = consumeDraft();
    if (draft === null) return;
    setText(draft);
    // Caret at the end, so a suggestion is a starting point rather than
    // something the user has to clear before typing.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(draft.length, draft.length);
    });
  }, [consumeDraft, pendingDraft]);

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

    // A fully-typed slash command runs instead of sending as a message.
    const action = resolveSlashCommand(text, toolGroupCatalogue, enabledToolGroups);
    if (action) {
      executeSlash(action);
      return;
    }

    if (!canSend) return;

    setIsSubmitting(true);
    try {
      const ready = attachments.filter((a) => a.status === "ready");
      await onSubmit(text.trim(), ready, {
        webSearchMode: webSearchEnabled ? "forced" : "auto",
      });
      setText("");
      clearAttachments();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashActiveIndex((i) => (i + 1) % slashItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashActiveIndex((i) => (i - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashDismissed(true);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = slashItems[slashActiveIndex] ?? slashItems[0];
        if (item) pickSlashSuggestion(item.insert);
        return;
      }
    }

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

  const inputDisabled = disabled || isSubmitting;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="relative">
      {slashMenuOpen && (
        <SlashCommandMenu
          items={slashItems}
          activeIndex={slashActiveIndex}
          onPick={(item) => pickSlashSuggestion(item.insert)}
          onHover={setSlashActiveIndex}
        />
      )}
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border border-border bg-background transition-shadow focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25",
          isDragging && "border-primary ring-[3px] ring-primary/15",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <ComposerAttachmentStrip
          attachments={attachments}
          onRemove={removeAttachment}
        />

        <div className="px-3 pt-2">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message…"
            autoComplete="off"
            disabled={inputDisabled}
            rows={1}
            className="max-h-40 min-h-[2.25rem] w-full resize-none border-0 bg-transparent py-1.5 text-sm leading-snug outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            className="sr-only"
            // Opened by the visible attach button, so it should not be its own
            // tab stop — but it still needs a name, since sr-only leaves it in
            // the accessibility tree.
            aria-label="Attach files"
            tabIndex={-1}
            disabled={inputDisabled}
            onChange={(e) => {
              if (e.target.files) {
                void addFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <ToolGroupsPopover disabled={inputDisabled} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Add to message"
                disabled={inputDisabled}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-44">
              <DropdownMenuItem
                disabled={inputDisabled}
                onSelect={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Attach files
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={inputDisabled}>
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
              <DropdownMenuCheckboxItem
                checked={webSearchEnabled}
                disabled={inputDisabled}
                onCheckedChange={(checked) => setWebSearchEnabled(checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                <Globe className="h-4 w-4" />
                Web Search
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {webSearchEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={inputDisabled}
              className="h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-medium"
              aria-label="Web search enabled"
              aria-pressed={webSearchEnabled}
              onClick={() => setWebSearchEnabled(false)}
            >
              <Globe className="h-3.5 w-3.5" />
              Web
            </Button>
          )}

          <ComposerAttachmentPill
            attachments={attachments}
            onRemove={removeAttachment}
            disabled={inputDisabled}
          />

          <div className="min-w-0 flex-1" aria-hidden="true" />

          <ContextUsageRing
            usedTokens={contextUsage.usedTokens}
            maxTokens={contextUsage.maxTokens}
            percent={contextUsage.percent}
            isLoading={contextUsage.isLoading}
            isEstimated={contextUsage.isEstimated}
            label={contextUsage.label}
          />

          <Button
            type="submit"
            className="shrink-0"
            aria-label="Send message"
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
