import { cn } from "@/lib/utils";

interface CitationBadgeProps {
  index: number;
  url: string;
  className?: string;
  /** When true, renders a non-interactive span (for use inside a parent link). */
  asSpan?: boolean;
}

const badgeClassName =
  "mx-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 px-1 text-[10px] font-semibold leading-none text-primary";

export function CitationBadge({
  index,
  url,
  className,
  asSpan = false,
}: CitationBadgeProps) {
  if (asSpan) {
    return (
      <span
        className={cn(badgeClassName, className)}
        aria-hidden
      >
        {index}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      aria-label={`Reference ${index}`}
      className={cn(
        badgeClassName,
        "no-underline transition-colors hover:border-primary/55 hover:bg-primary/20",
        className,
      )}
    >
      {index}
    </a>
  );
}
