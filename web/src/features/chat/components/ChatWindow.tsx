import {
  ArrowDown,
  Download,
  Info,
  Moon,
  MoreVertical,
  SquarePen,
  Sun,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
import { appQueryClient } from "@/app/providers";
import type { ChatMessage } from "@/app/stores/workspaceStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatComposer } from "@/features/chat/components/ChatComposer";
import { ChatEmptyState } from "@/features/chat/components/ChatEmptyState";
import { ChatMessage as ChatMessageBubble } from "@/features/chat/components/ChatMessage";
import { SessionInfoDialog } from "@/features/chat/components/SessionInfoDialog";
import { useChatAutoScroll } from "@/features/chat/hooks/useChatAutoScroll";
import type { PendingAttachment } from "@/features/chat/types/attachment";
import {
  buildLlmMessages,
  formatLlmError,
} from "@/features/chat/utils/buildLlmMessageContent";
import { groupMessagesIntoTurns } from "@/features/chat/utils/groupMessagesIntoTurns";
import { persistChatAttachments } from "@/features/chat/utils/persistChatAttachments";
import { streamLlm } from "@/services/llmClient";
import { useTheme } from "@/hooks/useTheme";
import { WorkspaceSidebarShell } from "@/features/workspace/components/WorkspaceSidebarShell";
import { ARTIFACTS_QUERY_KEY } from "@media-viewer/hooks/useArtifacts";

export function ChatWindow() {
  const { isDark, toggleTheme } = useTheme();

  const messages = useWorkspaceStore((s) => s.messages);
  const isTyping = useWorkspaceStore((s) => s.isTyping);
  const chatSessionId = useWorkspaceStore((s) => s.chatSessionId);
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const appendToMessage = useWorkspaceStore((s) => s.appendToMessage);
  const updateMessage = useWorkspaceStore((s) => s.updateMessage);
  const setIsTyping = useWorkspaceStore((s) => s.setIsTyping);
  const setArtifactNotice = useWorkspaceStore((s) => s.setArtifactNotice);
  const artifactNotice = useWorkspaceStore((s) => s.artifactNotice);
  const startNewChat = useWorkspaceStore((s) => s.startNewChat);
  const llmConfig = useLlmConfigStore((s) => s.config);

  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const streamScrollKey = useMemo(() => {
    const streaming = messages.find((message) => message.isStreaming);
    if (!streaming) return undefined;
    return `${streaming.id}:${streaming.thinking?.length ?? 0}:${streaming.content.length}`;
  }, [messages]);

  const {
    viewportRef,
    hasUnreadBelow,
    forceScrollToBottom,
  } = useChatAutoScroll({
      messagesLength: messages.length,
      isTyping,
      streamScrollKey,
    });

  const handleSubmit = async (
    text: string,
    pendingAttachments: PendingAttachment[],
  ) => {
    if (isTyping) return;

    const attachments = pendingAttachments
      .map((pending) => pending.attachment)
      .filter((attachment): attachment is NonNullable<typeof attachment> =>
        Boolean(attachment),
      );

    if (!text && attachments.length === 0) return;

    const pendingUserMessage: ChatMessage = {
      id: "pending-user",
      role: "user",
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
    };

    const history = [...messages, pendingUserMessage];

    const userMessageId = addMessage({
      role: "user",
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    forceScrollToBottom();

    if (pendingAttachments.length > 0) {
      void persistChatAttachments(pendingAttachments, {
        chatSessionId,
        messageId: userMessageId,
      })
        .then((results) => {
          if (results.length === 0) return;
          const current = useWorkspaceStore
            .getState()
            .messages.find((entry) => entry.id === userMessageId);
          if (!current?.attachments) return;

          const artifactByAttachmentId = new Map(
            results.map((result) => [result.attachmentId, result.artifactId]),
          );
          updateMessage(userMessageId, {
            attachments: current.attachments.map((attachment) => ({
              ...attachment,
              artifactId:
                artifactByAttachmentId.get(attachment.id) ?? attachment.artifactId,
            })),
          });
          appQueryClient.invalidateQueries({ queryKey: ARTIFACTS_QUERY_KEY });
        })
        .catch((persistError) => {
          console.warn("Failed to persist chat attachments as artifacts", persistError);
          const message =
            persistError instanceof Error
              ? persistError.message
              : "Could not save attachments to artifacts";
          setArtifactNotice(message);
          window.setTimeout(() => {
            if (useWorkspaceStore.getState().artifactNotice === message) {
              setArtifactNotice(null);
            }
          }, 8000);
        });
    }

    setIsTyping(true);

    const agentMessageId = addMessage({
      role: "agent",
      content: "",
      thinking: "",
      isStreaming: true,
    });
    forceScrollToBottom();

    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      await streamLlm(
        buildLlmMessages(history),
        llmConfig,
        {
          onThinkingDelta: (delta) => {
            appendToMessage(agentMessageId, { thinking: delta });
          },
          onContentDelta: (delta) => {
            appendToMessage(agentMessageId, { content: delta });
          },
        },
        abortController.signal,
      );
      updateMessage(agentMessageId, { isStreaming: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message = formatLlmError(error);
      const current = useWorkspaceStore
        .getState()
        .messages.find((entry) => entry.id === agentMessageId);
      updateMessage(agentMessageId, {
        content: current?.content
          ? `${current.content}\n\n**Error:** ${message}`
          : `Error: ${message}`,
        isStreaming: false,
      });
    } finally {
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null;
      }
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    startNewChat();
    forceScrollToBottom();
  };

  return (
    <WorkspaceSidebarShell>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              Mango agent
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 px-2.5"
              aria-label="Start new chat"
              onClick={handleNewChat}
            >
              <SquarePen className="h-4 w-4" />
              New Chat
            </Button>

            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setSessionInfoOpen(true)}>
                <Info className="h-4 w-4" />
                Session info
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => undefined}>
                <Download className="h-4 w-4" />
                Export chat
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleTheme}>
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {isDark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={handleNewChat}
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <SessionInfoDialog
          open={sessionInfoOpen}
          onOpenChange={setSessionInfoOpen}
        />

        <ScrollArea viewportRef={viewportRef} className="min-w-0 flex-1 bg-background">
          <div className="flex min-w-0 max-w-full flex-col gap-3 p-3">
            {messages.length === 0 && !isTyping && <ChatEmptyState />}
            {groupMessagesIntoTurns(messages).map((turn) => (
              <ChatMessageBubble key={turn.id} turn={turn} />
            ))}
          </div>
        </ScrollArea>

        {hasUnreadBelow && (
          <div className="relative shrink-0 px-3 pb-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 shadow-md"
              onClick={forceScrollToBottom}
            >
              <ArrowDown className="h-4 w-4" />
              New messages
            </Button>
          </div>
        )}

        <div className="shrink-0 border-t border-border bg-card p-3">
          {artifactNotice && (
            <div
              role="status"
              className="mb-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {artifactNotice}
            </div>
          )}
          <ChatComposer
            key={chatSessionId}
            disabled={isTyping}
            onSubmit={handleSubmit}
          />
        </div>
    </WorkspaceSidebarShell>
  );
}
