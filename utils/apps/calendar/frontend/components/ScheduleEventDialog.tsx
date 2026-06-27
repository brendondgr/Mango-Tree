import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleEvent } from "@/types/calendar";

import { useAddScheduleEvent } from "../hooks/useCalendar";
import { DOW_LABELS } from "../utils/dates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: string;
  /** Prefill when opened from a grid cell (0=Mon..6=Sun). */
  defaultDay?: number;
  defaultStart?: string;
}

/** "HH:MM" + whole hours, clamped to 23:00. */
function addHour(time: string): string {
  const [h] = time.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:00`;
}

/** Add a recurring event to a schedule (one or more weekdays). */
export function ScheduleEventDialog({
  open,
  onOpenChange,
  file,
  defaultDay = 0,
  defaultStart = "09:00",
}: Props) {
  const add = useAddScheduleEvent(file);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("other");
  const [days, setDays] = useState<number[]>([0]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [sub, setSub] = useState("");
  const [overwriteable, setOverwriteable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("other");
    setDays([defaultDay]);
    setStart(defaultStart);
    setEnd(addHour(defaultStart));
    setSub("");
    setOverwriteable(false);
    setError(null);
  }, [open, defaultDay, defaultStart]);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  async function handleAdd() {
    setError(null);
    if (!title || days.length === 0) {
      setError("Title and at least one day are required.");
      return;
    }
    const event: ScheduleEvent = {
      title,
      type: type || "other",
      day: days.length === 1 ? days[0] : days,
      start,
      end,
    };
    if (sub) event.sub = sub;
    if (overwriteable) event.overwriteable = true;
    try {
      await add.mutateAsync(event);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add event");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add schedule event</DialogTitle>
          <DialogDescription>
            A recurring activity on the chosen weekday(s).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cal-se-title">Title</Label>
            <Input id="cal-se-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1">
              {DOW_LABELS.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  className="calendar-tab"
                  data-active={days.includes(d)}
                  onClick={() => toggleDay(d)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-se-type">Type</Label>
              <Input id="cal-se-type" value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cal-se-sub">Note (optional)</Label>
              <Input id="cal-se-sub" value={sub} onChange={(e) => setSub(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-se-start">Start</Label>
              <Input id="cal-se-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cal-se-end">End</Label>
              <Input id="cal-se-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={overwriteable}
              onChange={(e) => setOverwriteable(e.target.checked)}
            />
            Background activity (other events cut into it)
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={add.isPending || !title || days.length === 0}>
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
