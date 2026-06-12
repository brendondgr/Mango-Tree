import { motion, useReducedMotion } from "framer-motion";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { AgentReply } from "@/features/chat/components/AgentReply";
import { MessageAttachments } from "@/features/chat/components/MessageAttachments";
import type { ChatTurn } from "@/features/chat/utils/groupMessagesIntoTurns";

interface ChatMessageProps {
  turn: ChatTurn;
}

function formatChatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessage({ turn }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();

  const ariaLabel = turn.user
    ? `You at ${formatChatTime(turn.user.timestamp)}${
        turn.replies.length
          ? `, agent replied ${turn.replies.length} time${turn.replies.length === 1 ? "" : "s"}`
          : ""
      }`
    : turn.replies.length === 1
      ? `Agent message at ${formatChatTime(turn.replies[0]!.timestamp)}`
      : `Agent messages, ${turn.replies.length} replies`;

  return (
    <motion.div
      className="flex min-w-0 max-w-full flex-col gap-1.5"
      aria-label={ariaLabel}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {turn.user && (
        <>
          <div className="flex justify-end">
            <span className="text-[10px] text-muted-foreground/60">
              {formatChatTime(turn.user.timestamp)}
            </span>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-[var(--radius-lg)] rounded-br-sm border border-primary/25 bg-secondary px-3 py-2 text-sm leading-snug text-foreground shadow-sm">
              {turn.user.attachments && turn.user.attachments.length > 0 && (
                <MessageAttachments
                  attachments={turn.user.attachments}
                  variant="user"
                />
              )}
              {turn.user.content ? (
                <div className="[&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted/80">
                  <MarkdownContent content={turn.user.content} />
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
      {turn.replies.map((reply) => (
        <AgentReply
          key={reply.id}
          content={reply.content}
          thinking={reply.thinking}
          isStreaming={reply.isStreaming}
          timestamp={reply.timestamp}
        />
      ))}
    </motion.div>
  );
}
