import {
  ArrowDown,
  Download,
  Info,
  Moon,
  MoreVertical,
  Sun,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";

import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
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
import { useChatAutoScroll } from "@/features/chat/hooks/useChatAutoScroll";
import type { PendingAttachment } from "@/features/chat/types/attachment";
import {
  buildLlmMessages,
  formatLlmError,
} from "@/features/chat/utils/buildLlmMessageContent";
import { groupMessagesIntoTurns } from "@/features/chat/utils/groupMessagesIntoTurns";
import { streamLlm } from "@/services/llmClient";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ChatWindow() {
  const { isDark, toggleTheme } = useTheme();

  const messages = useWorkspaceStore((s) => s.messages);
  const isTyping = useWorkspaceStore((s) => s.isTyping);
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const appendToMessage = useWorkspaceStore((s) => s.appendToMessage);
  const updateMessage = useWorkspaceStore((s) => s.updateMessage);
  const setIsTyping = useWorkspaceStore((s) => s.setIsTyping);
  const clearMessages = useWorkspaceStore((s) => s.clearMessages);
  const llmConfig = useLlmConfigStore((s) => s.config);

  const streamScrollKey = useMemo(() => {
    const streaming = messages.find((message) => message.isStreaming);
    if (!streaming) return undefined;
    return `${streaming.id}:${streaming.thinking?.length ?? 0}:${streaming.content.length}`;
  }, [messages]);

  const {
    isMobile,
    isResizing,
    sidebarCollapsed,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    collapseSidebar,
  } = useSidebarResize();

  const { viewportRef, hasUnreadBelow, forceScrollToBottom } =
    useChatAutoScroll({
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

    addMessage({
      role: "user",
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    forceScrollToBottom();
    setIsTyping(true);

    const agentMessageId = addMessage({
      role: "agent",
      content: "",
      thinking: "",
      isStreaming: true,
    });
    forceScrollToBottom();

    try {
      await streamLlm(buildLlmMessages(history), llmConfig, {
        onThinkingDelta: (delta) => {
          appendToMessage(agentMessageId, { thinking: delta });
        },
        onContentDelta: (delta) => {
          appendToMessage(agentMessageId, { content: delta });
        },
      });
      updateMessage(agentMessageId, { isStreaming: false });
    } catch (error) {
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
      setIsTyping(false);
    }
  };

  const mobileWidth = "min(92vw, 360px)";
  const desktopWidth = `${displayWidth}px`;

  return (
    <div
      className={cn(
        "relative z-20 h-full shrink-0 overflow-hidden",
        !isResizing &&
          "transition-[width] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        isMobile && "fixed left-0 top-0 shadow-xl",
        isMobile && sidebarCollapsed && "-translate-x-full",
        isMobile && !sidebarCollapsed && "translate-x-0",
        isMobile &&
          "transition-[transform] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
      )}
      style={{ width: isMobile ? mobileWidth : desktopWidth }}
    >
      {!isMobile && (
        <div
          role="separator"
          aria-label="Resize sidebar — drag to adjust, click to collapse or expand"
          aria-orientation="vertical"
          tabIndex={0}
          className={cn(
            "absolute -right-[5px] top-0 z-30 flex h-full w-2.5 cursor-col-resize touch-none items-center justify-center gap-0.5 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            displayWidth === 0 &&
              !isResizing &&
              "fixed left-0 bg-primary/[0.04]",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            beginResize(e.clientX);
          }}
          onKeyDown={onHandleKeyDown}
        >
          <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
          <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>
      )}

      <aside
        className={cn(
          "flex h-full flex-col overflow-hidden border-r border-border bg-card transition-opacity duration-150",
          !isMobile &&
            displayWidth === 0 &&
            !isResizing &&
            "pointer-events-none opacity-0",
        )}
        style={{ width: isMobile ? mobileWidth : desktopWidth }}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              Agent Core
            </p>
            <p className="text-[11px] tracking-wide text-muted-foreground">
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle"
                aria-hidden
              />
              Online
            </p>
          </div>

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
              <DropdownMenuItem onSelect={() => undefined}>
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
                onSelect={() => clearMessages()}
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

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
          <ChatComposer disabled={isTyping} onSubmit={handleSubmit} />
        </div>
      </aside>

      {isMobile && !sidebarCollapsed && (
        <button
          type="button"
          className="sr-only"
          onClick={collapseSidebar}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}
