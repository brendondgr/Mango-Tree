import { useMemo } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Category } from "@/types/timekeeper";

import { useAllLogs, useDeleteLog } from "@timekeeper/hooks/useTimekeeper";
import { formatMinutes } from "@timekeeper/utils/blocks";
import { buildResolver } from "@timekeeper/utils/colors";

interface Props {
  categories: Category[];
}

export function LogsView({ categories }: Props) {
  const { data: logs, isLoading } = useAllLogs();
  const deleteLog = useDeleteLog();
  const resolver = useMemo(() => buildResolver(categories), [categories]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const rows = (logs ?? []).filter((l) => l.duration > 0);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <h2 className="mb-4 text-xl font-bold">Historical Logs</h2>
      <div className="timekeeper-card overflow-hidden">
        <table className="timekeeper-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Start</th>
              <th>Category</th>
              <th>Duration</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground">
                  No logs recorded yet.
                </td>
              </tr>
            )}
            {rows.map((log) => {
              const r = resolver.resolve(log.category_id, log.subcategory_id);
              return (
                <tr key={log.id}>
                  <td className="font-medium tabular-nums">{log.date}</td>
                  <td className="tabular-nums">{log.start_time}</td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="timekeeper-swatch"
                        style={{ background: r.color }}
                      />
                      {r.categoryName}
                      {r.subcategoryName && (
                        <span className="text-muted-foreground">· {r.subcategoryName}</span>
                      )}
                    </span>
                  </td>
                  <td className="tabular-nums">{formatMinutes(log.duration)}</td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLog.mutate(log.id)}
                      disabled={deleteLog.isPending}
                      aria-label={`Delete log ${log.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
