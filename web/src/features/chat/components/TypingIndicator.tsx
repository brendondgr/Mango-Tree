export function TypingIndicator() {
  return (
    <div
      className="flex gap-1 py-1"
      role="status"
      aria-label="Agent is typing"
    >
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:200ms]" />
      <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:400ms]" />
    </div>
  );
}
