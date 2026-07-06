import type { SlashSuggestion } from "@/features/chat/utils/slashCommands";
import { cn } from "@/lib/utils";

interface SlashCommandMenuProps {
  items: SlashSuggestion[];
  activeIndex: number;
  onPick: (item: SlashSuggestion) => void;
  onHover: (index: number) => void;
}

export function SlashCommandMenu({
  items,
  activeIndex,
  onPick,
  onHover,
}: SlashCommandMenuProps) {
  if (items.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-[var(--radius-md)] border border-border bg-popover p-1 text-popover-foreground shadow-md">
      <ul role="listbox" aria-label="Slash commands" className="max-h-56 overflow-y-auto">
        {items.map((item, index) => (
          <li key={item.label}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onHover(index)}
              // mousedown (not click) so the textarea keeps focus for the next token
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(item);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
