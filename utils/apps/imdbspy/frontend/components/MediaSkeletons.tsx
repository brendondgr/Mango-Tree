import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched placeholders.
 *
 * They mirror the real card and row boxes — poster width, the 11.25rem info
 * column, the 4rem thumb — so the library does not jump when the request
 * lands. A generic spinner was what used to stand here.
 */

export const GRID_COLUMNS =
  "[grid-template-columns:repeat(auto-fill,minmax(min(100%,28rem),1fr))]";

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      <div className="flex">
        <Skeleton className="h-[11.25rem] w-[32%] min-w-[5rem] max-w-[11.875rem] shrink-0 rounded-none" />
        <div className="flex min-h-[11.25rem] flex-1 flex-col justify-center gap-2 p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}

export function MediaGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-3 ${GRID_COLUMNS} @[48rem]:gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MediaListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card p-2"
        >
          <Skeleton className="h-16 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}
