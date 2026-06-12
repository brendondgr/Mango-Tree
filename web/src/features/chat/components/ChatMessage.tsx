import { motion, useReducedMotion } from "framer-motion";

import type { ChatMessage as ChatMessageType } from "@/app/stores/workspaceStore";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  const time = message.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      className={cn(
        "flex w-full gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground",
          isUser && "bg-primary",
        )}
        style={isUser ? undefined : { background: "var(--brand-gradient)" }}
        aria-hidden
      >
        {isUser ? "U" : "A"}
      </div>
      <div className="flex max-w-[80%] flex-col">
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          {isUser ? "You" : "Agent Core"}
        </div>
        <div
          className={cn(
            "px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "rounded-[var(--radius-lg)] rounded-br-sm bg-primary text-primary-foreground shadow-sm"
              : "rounded-[var(--radius-lg)] rounded-bl-sm border border-border bg-secondary text-secondary-foreground",
          )}
        >
          {message.content}
        </div>
        <div className="mt-1.5 text-right text-[11px] text-muted-foreground opacity-60">
          {time}
        </div>
      </div>
    </motion.div>
  );
}
