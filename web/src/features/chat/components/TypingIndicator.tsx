export function TypingIndicator() {
  return (
    <div
      className="flex w-fit gap-1 rounded-[var(--radius-lg)] border border-border bg-secondary px-4 py-2"
      role="status"
      aria-label="Agent is typing"
    >
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:200ms]" />
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:400ms]" />
    </div>
  );
}
