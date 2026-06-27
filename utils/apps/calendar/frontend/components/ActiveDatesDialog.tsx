import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  useAddEntry,
  useConfig,
  useDeleteEntry,
  useSchedules,
} from "../hooks/useCalendar";

function strip(name: string): string {
  return name.replace(/\.json$/, "");
}

/**
 * Map a schedule onto a date range, and review/remove existing mappings.
 * This is calendar-wide config, so it lives with the dated Calendar tab
 * (next to "+ Event") rather than inside a single schedule's editor.
 */
export function ActiveDatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const schedules = useSchedules();
  const config = useConfig();
  const addEntry = useAddEntry();
  const deleteEntry = useDeleteEntry();

  const [schedule, setSchedule] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStart("");
    setEnd("");
    setSchedule((s) => s || schedules.data?.[0] || "");
  }, [open, schedules.data]);

  const entries = (config.data?.entries ?? []).map((e, i) => ({ ...e, _index: i }));

  async function handleAdd() {
    setError(null);
    if (!schedule || !start || !end) {
      setError("Pick a schedule and both dates.");
      return;
    }
    try {
      await addEntry.mutateAsync({
        start_date: start,
        end_date: end,
        schedule_filename: schedule,
      });
      setStart("");
      setEnd("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add mapping");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Active dates</DialogTitle>
          <DialogDescription>
            Map a schedule onto a date range. Mapped days show that schedule's
            events on the calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* existing mappings */}
          <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
            {entries.map((e) => (
              <li
                key={e._index}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {strip(e.schedule_filename)}
                </span>
                <span className="text-muted-foreground">
                  {e.start_date} → {e.end_date}
                </span>
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => deleteEntry.mutate(e._index)}
                  aria-label="Remove mapping"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {entries.length === 0 ? (
              <li className="text-sm text-muted-foreground">No mappings yet.</li>
            ) : null}
          </ul>

          {/* add a mapping */}
          <div className="grid gap-1.5">
            <Label htmlFor="cal-ad-schedule">Schedule</Label>
            <select
              id="cal-ad-schedule"
              className="rounded-[var(--radius-sm)] border border-border bg-background px-2 py-2 text-sm"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              {(schedules.data ?? []).map((file) => (
                <option key={file} value={file}>
                  {strip(file)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ad-start">Start</Label>
              <Input
                id="cal-ad-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ad-end">End</Label>
              <Input
                id="cal-ad-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            onClick={handleAdd}
            disabled={addEntry.isPending || !schedule || !start || !end}
          >
            Map dates
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
