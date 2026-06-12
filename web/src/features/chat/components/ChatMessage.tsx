import { motion, useReducedMotion } from "framer-motion";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import type { ChatTurn } from "@/features/chat/utils/groupMessagesIntoTurns";

interface ChatMessageProps {
  turn: ChatTurn;
}

export function ChatMessage({ turn }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();

  const time = turn.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const ariaLabel = turn.user
    ? `You at ${time}${turn.replies.length ? `, agent replied` : ""}`
    : `Agent message at ${time}`;

  return (
    <motion.div
      className="flex flex-col gap-1"
      aria-label={ariaLabel}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex justify-end">
        <span className="text-[10px] text-muted-foreground/60">{time}</span>
      </div>
      {turn.user && (
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-[var(--radius-lg)] rounded-br-sm bg-primary px-3 py-2 text-sm leading-snug text-primary-foreground shadow-sm">
            {turn.user.content}
          </div>
        </div>
      )}
      {turn.replies.map((reply) => (
        <MarkdownContent key={reply.id} content={reply.content} />
      ))}
    </motion.div>
  );
}
