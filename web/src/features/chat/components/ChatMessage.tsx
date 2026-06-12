import { motion, useReducedMotion } from "framer-motion";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
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
      className="flex flex-col gap-1.5"
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
            <div className="max-w-[90%] rounded-[var(--radius-lg)] rounded-br-sm bg-primary px-3 py-2 text-sm leading-snug text-primary-foreground shadow-sm">
              {turn.user.content}
            </div>
          </div>
        </>
      )}
      {turn.replies.map((reply) => (
        <div key={reply.id} className="flex flex-col gap-0.5">
          <div className="flex justify-start">
            <span className="text-[10px] text-muted-foreground/60">
              {formatChatTime(reply.timestamp)}
            </span>
          </div>
          <MarkdownContent content={reply.content} />
        </div>
      ))}
    </motion.div>
  );
}
