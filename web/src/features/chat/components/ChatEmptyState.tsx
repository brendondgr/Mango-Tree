import { FolderOpen, ListTodo, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shown before the first message of a session.
 *
 * The previous version stated a capability ("Attach images, videos, code, or
 * PDFs") and stopped there, which leaves a first-time user with an empty box
 * and no idea what this agent can actually do. These prompts are examples, not
 * a menu: selecting one fills the composer so it can be edited before sending.
 */
const SUGGESTIONS = [
  {
    icon: ListTodo,
    label: "What's on my calendar this week?",
  },
  {
    icon: FolderOpen,
    label: "Summarise the artifacts I saved recently",
  },
  {
    icon: Sparkles,
    label: "What can you help me with?",
  },
];

export function ChatEmptyState({
  onSuggestion,
}: {
  onSuggestion?: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface-2 text-muted-foreground shadow-xs"
        aria-hidden
        data-enter
        style={{ "--i": 0 } as never}
      >
        <Sparkles className="h-5 w-5" />
      </div>

      <p
        className="text-sm font-semibold text-foreground"
        data-enter
        style={{ "--i": 1 } as never}
      >
        Ready when you are
      </p>
      <p
        className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground"
        data-enter
        style={{ "--i": 2 } as never}
      >
        Ask a question, or attach images, video, code or PDFs. Turn on tool
        groups to let the agent reach your apps.
      </p>

      {onSuggestion && (
        <ul className="mt-5 flex w-full max-w-sm flex-col gap-1.5">
          {SUGGESTIONS.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <li
                key={suggestion.label}
                data-enter
                style={{ "--i": index + 3 } as never}
              >
                <button
                  type="button"
                  onClick={() => onSuggestion(suggestion.label)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-md)]",
                    "border border-border bg-surface-1 px-3 py-2 text-left text-xs",
                    "text-muted-foreground transition-colors",
                    "hover:border-primary/40 hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span className="min-w-0">{suggestion.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
