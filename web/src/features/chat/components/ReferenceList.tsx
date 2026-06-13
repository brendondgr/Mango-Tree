import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";
import { cn } from "@/lib/utils";

interface ReferenceListProps {
  references: ChatReference[];
  className?: string;
}

export function ReferenceList({ references, className }: ReferenceListProps) {
  if (references.length === 0) return null;

  return (
    <section
      className={cn(
        "mt-3 border-t border-border/70 pt-3",
        className,
      )}
      aria-label="References"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        References
      </p>
      <ol className="space-y-1.5">
        {references.map((reference) => (
          <li
            key={`${reference.index}-${reference.url}`}
            className="flex min-w-0 gap-2 text-xs leading-snug"
          >
            <span className="shrink-0 font-medium text-muted-foreground">
              [{reference.index}]
            </span>
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 break-words text-primary underline-offset-2 hover:underline [overflow-wrap:anywhere]"
            >
              {reference.title}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
