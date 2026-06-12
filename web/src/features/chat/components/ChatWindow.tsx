import {
  Download,
  Info,
  Moon,
  MoreVertical,
  Send,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatEmptyState } from "@/features/chat/components/ChatEmptyState";
import { ChatMessage } from "@/features/chat/components/ChatMessage";
import { TypingIndicator } from "@/features/chat/components/TypingIndicator";
import { groupMessagesIntoTurns } from "@/features/chat/utils/groupMessagesIntoTurns";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const MOCK_REPLY =
  "Your workspace environment has been polished. All systems operational.";

export function ChatWindow() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const { isDark, toggleTheme } = useTheme();

  const messages = useWorkspaceStore((s) => s.messages);
  const isTyping = useWorkspaceStore((s) => s.isTyping);
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const setIsTyping = useWorkspaceStore((s) => s.setIsTyping);
  const clearMessages = useWorkspaceStore((s) => s.clearMessages);

  const {
    isMobile,
    isResizing,
    sidebarCollapsed,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    collapseSidebar,
  } = useSidebarResize();

  useEffect(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    addMessage({ role: "user", content: text });
    setInput("");
    setIsTyping(true);

    window.setTimeout(() => {
      setIsTyping(false);
      addMessage({ role: "agent", content: MOCK_REPLY });
    }, 1500);
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

        <ScrollArea className="flex-1 bg-background">
          <div ref={viewportRef} className="flex flex-col gap-3 p-3">
            {messages.length === 0 && !isTyping && <ChatEmptyState />}
            {groupMessagesIntoTurns(messages).map((turn) => (
              <ChatMessage key={turn.id} turn={turn} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-card p-3">
          <form onSubmit={handleSubmit}>
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-background px-4 py-1.5 transition-shadow focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
              <Input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                autoComplete="off"
                className="flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
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
