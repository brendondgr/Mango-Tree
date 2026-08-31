import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * The four states every async surface has, in one place.
 *
 * Before this existed, the state matrix across the app was roughly 22 surfaces
 * × 4 states with well under half the cells filled: most panels swapped in a
 * bare "Loading…" string, several rendered their empty copy while still
 * fetching (so "No login attempts recorded yet" flashed before the real list),
 * and error branches rarely offered a retry.
 *
 * Precedence is deliberate: error beats loading beats empty. A refetch that
 * fails should keep showing the error rather than flipping back to a spinner.
 */
export interface AsyncBoundaryProps {
  loading: boolean;
  error?: unknown;
  /** True when the request succeeded but returned nothing. */
  empty?: boolean;
  /** Shape-matched placeholder. Falls back to a generic list skeleton. */
  skeleton?: ReactNode;
  onRetry?: () => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Describes what is loading, for the screen-reader announcement. */
  label?: string;
  className?: string;
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
}

export function AsyncBoundary({
  loading,
  error,
  empty = false,
  skeleton,
  onRetry,
  emptyIcon,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  label = "content",
  className,
  children,
}: AsyncBoundaryProps) {
  if (error) {
    return (
      <div className={className} role="alert">
        <EmptyState
          icon={AlertTriangle}
          title={`Couldn't load ${label}`}
          description={errorMessage(error)}
          action={
            onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(className)} aria-busy="true">
        <span className="sr-only">Loading {label}…</span>
        {skeleton ?? <DefaultSkeleton />}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={className}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

function DefaultSkeleton() {
  // Imported lazily-by-reference to avoid a cycle: skeleton.tsx has no deps on
  // this module, so a direct import is fine, but keeping the fallback here
  // documents that a caller really should pass a shape-matched one.
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-muted/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
