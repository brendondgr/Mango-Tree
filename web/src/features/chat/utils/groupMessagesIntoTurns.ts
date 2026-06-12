import type { ChatMessage } from "@/app/stores/workspaceStore";

export interface ChatTurn {
  id: string;
  user?: ChatMessage;
  replies: ChatMessage[];
  timestamp: Date;
}

export function groupMessagesIntoTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: message.id,
        user: message,
        replies: [],
        timestamp: message.timestamp,
      });
      continue;
    }

    const current = turns.at(-1);
    if (current?.user) {
      current.replies.push(message);
      continue;
    }

    turns.push({
      id: message.id,
      replies: [message],
      timestamp: message.timestamp,
    });
  }

  return turns;
}
