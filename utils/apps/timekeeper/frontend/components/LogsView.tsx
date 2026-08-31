import { useMemo } from "react";
import { Clock, Loader2, Trash2 } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";

import { useAllLogs, useCategories, useDeleteLog } from "@timekeeper/hooks/useTimekeeper";
import { formatMinutes } from "@timekeeper/utils/blocks";
import { buildResolver } from "@timekeeper/utils/colors";

/**
 * Every logged interval, newest first.
 *
 * The table used to sit directly inside an `overflow-hidden` card, so below
 * roughly 430px of pane the Actions column — and with it every delete button —
 * was simply cut off with no way to reach it. It now lives in a focusable
 * `.scroll-region`, which scrolls with a finger, a trackpad, or the arrow keys.
 */
export function LogsView() {
  const setView = useWorkspaceStore((state) => state.setTimekeeperView);
  const logsQuery = useAllLogs();
  const categoriesQuery = useCategories();
  const deleteLog = useDeleteLog();

  const resolver = useMemo(
    () => buildResolver(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const rows = useMemo(
    () => (logsQuery.data ?? []).filter((log) => log.duration > 0),
    [logsQuery.data],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3 @[34rem]:p-4 @[60rem]:p-6">
      {deleteLog.isError && (
        <p role="alert" className="text-sm text-destructive">
          {(deleteLog.error as Error).message}
        </p>
      )}

      <AsyncBoundary
        loading={logsQuery.isLoading || categoriesQuery.isLoading}
        error={logsQuery.error ?? categoriesQuery.error}
        empty={rows.length === 0}
        onRetry={() => {
          void logsQuery.refetch();
          void categoriesQuery.refetch();
        }}
        label="tracked logs"
        skeleton={
          <div className="rounded-[var(--radius-lg)] border border-border bg-card p-3">
            <SkeletonList count={6} />
          </div>
        }
        emptyIcon={Clock}
        emptyTitle="No logs recorded yet"
        emptyDescription="Paint a day on the tracker and submit it — every interval you save shows up here."
        emptyAction={
          <Button variant="outline" onClick={() => setView("tracker")}>
            Open the tracker
          </Button>
        }
        className="rounded-[var(--radius-lg)] border border-border bg-card shadow-xs"
      >
        <div
          className="scroll-region rounded-[var(--radius-lg)]"
          role="region"
          aria-label="Tracked logs"
          tabIndex={0}
        >
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr>
                {["Date", "Start", "Category", "Duration"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {heading}
                  </th>
                ))}
                <th
                  scope="col"
                  className="border-b border-border px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log, index) => {
                const resolved = resolver.resolve(log.category_id, log.subcategory_id);
                const pending = deleteLog.isPending && deleteLog.variables === log.id;
                return (
                  <tr
                    key={log.id}
                    data-enter
                    style={{ "--i": index } as never}
                    className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-2 font-medium tabular-nums">{log.date}</td>
                    <td className="px-3 py-2 tabular-nums">{log.start_time}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 rounded-[var(--radius-sm)] border border-border/50"
                          style={{ background: resolved.color }}
                        />
                        <span className="truncate">{resolved.categoryName}</span>
                        {resolved.subcategoryName && (
                          <span className="truncate text-muted-foreground">
                            · {resolved.subcategoryName}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatMinutes(log.duration)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteLog.mutate(log.id)}
                        disabled={pending}
                        aria-label={`Delete the ${resolved.categoryName} log on ${log.date} at ${log.start_time}`}
                      >
                        {pending ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncBoundary>
    </div>
  );
}
