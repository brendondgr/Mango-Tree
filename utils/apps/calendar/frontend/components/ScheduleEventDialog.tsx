import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, useFormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ScheduleEvent } from "@/types/calendar";

import { useAddScheduleEvent } from "../hooks/useCalendar";
import { DOW_LABELS } from "../utils/dates";

type FieldName = "title" | "days" | "time";

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
  const { errors, formError, setErrors, setFormError, clear } =
    useFormErrors<FieldName>();

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("other");
    setDays([defaultDay]);
    setStart(defaultStart);
    setEnd(addHour(defaultStart));
    setSub("");
    setOverwriteable(false);
    clear();
  }, [open, defaultDay, defaultStart, clear]);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Partial<Record<FieldName, string>> = {};
    if (!title.trim()) next.title = "Give the event a title.";
    if (days.length === 0) next.days = "Choose at least one weekday.";
    // Only a zero-length event is rejected. A schedule event may run past
    // midnight — the backend's `validate_time_fields` checks the HH:MM format
    // and nothing else — so refusing `start > end` would have made a stored
    // 22:00–02:00 block unrepeatable through this form.
    if (start === end) {
      next.time = "The start and end times can't be the same.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add event");
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

        <form onSubmit={handleAdd} className="contents">
          <DialogBody className="space-y-3">
            <Field label="Title" required error={errors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            {/* Weekdays are a multi-select, not a tab set: they were previously
                styled with the same markup as the view switcher, which told a
                screen reader they were tabs and that six of the seven were
                unselected pages. */}
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-foreground">
                Days
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {DOW_LABELS.map((label, d) => (
                  <button
                    key={d}
                    type="button"
                    className="min-h-11 min-w-11 rounded-[var(--radius-md)] border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring app:min-h-9 app:min-w-9 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary-emphasis"
                    aria-pressed={days.includes(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.days ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {errors.days}
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" hint="Sets the color on the grid.">
                <Input value={type} onChange={(e) => setType(e.target.value)} />
              </Field>
              <Field label="Note" hint="Optional.">
                <Input value={sub} onChange={(e) => setSub(e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start" required error={errors.time}>
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="End" required>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>

            <label className="flex min-h-11 items-center gap-2.5 text-sm text-foreground app:min-h-9">
              <input
                type="checkbox"
                className="h-6 w-6 shrink-0 accent-[hsl(var(--primary))]"
                checked={overwriteable}
                onChange={(e) => setOverwriteable(e.target.checked)}
              />
              Background activity (other events cut into it)
            </label>

            {formError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending}>
              Add event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
