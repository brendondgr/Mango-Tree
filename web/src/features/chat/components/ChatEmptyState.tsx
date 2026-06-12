import { MessageSquare } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="mt-20 px-4 text-center text-muted-foreground">
      <div
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted text-muted-foreground"
        aria-hidden
      >
        <MessageSquare className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">
        Ready for your commands
      </p>
      <p className="mt-1 text-xs tracking-wide opacity-80">
        Attach images, videos, code, or PDFs
      </p>
    </div>
  );
}
