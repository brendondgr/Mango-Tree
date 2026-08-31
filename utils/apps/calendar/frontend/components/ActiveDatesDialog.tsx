import { useEffect, useState } from "react";
import { CalendarRange, ListTodo, Trash2 } from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
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
import {
  Field,
  SelectField,
  selectFieldTriggerProps,
  useFormErrors,
  useSelectFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

import {
  useAddEntry,
  useConfig,
  useDeleteEntry,
  useSchedules,
} from "../hooks/useCalendar";

type FieldName = "schedule" | "start" | "end";

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
  const { errors, formError, setErrors, setFormError, clear } =
    useFormErrors<FieldName>();
  const scheduleIds = useSelectFieldIds();

  useEffect(() => {
    if (!open) return;
    clear();
    setStart("");
    setEnd("");
    setSchedule((s) => s || schedules.data?.[0] || "");
  }, [open, schedules.data, clear]);

  const entries = (config.data?.entries ?? []).map((e, i) => ({ ...e, _index: i }));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Partial<Record<FieldName, string>> = {};
    if (!schedule) next.schedule = "Pick a schedule.";
    if (!start) next.start = "Pick a start date.";
    if (!end) next.end = "Pick an end date.";
    if (start && end && start > end) next.end = "The end date must not precede the start.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await addEntry.mutateAsync({
        start_date: start,
        end_date: end,
        schedule_filename: schedule,
      });
      setStart("");
      setEnd("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add mapping");
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

        <form onSubmit={handleAdd} className="contents">
          <DialogBody className="space-y-4">
            <section aria-label="Existing mappings">
              {/* `config.data?.entries ?? []` reads the same as "there are no
                  mappings" whether the request is still in flight or failed
                  outright, so the four states go through AsyncBoundary rather
                  than collapsing into the empty one. */}
              <AsyncBoundary
                label="the existing mappings"
                loading={config.isPending}
                error={config.error}
                empty={entries.length === 0}
                onRetry={() => void config.refetch()}
                skeleton={<SkeletonList count={2} />}
                emptyIcon={CalendarRange}
                emptyTitle="No mappings yet"
                emptyDescription="Nothing is scheduled onto a date range."
              >
                <ul className="flex flex-col gap-1">
                  {entries.map((e, idx) => (
                    <li
                      key={e._index}
                      data-enter
                      style={{ "--i": idx } as never}
                      className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-sm app:min-h-9"
                    >
                      <span className="font-medium text-foreground">
                        {strip(e.schedule_filename)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {e.start_date} → {e.end_date}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => deleteEntry.mutate(e._index)}
                        aria-label={`Remove ${strip(e.schedule_filename)} from ${e.start_date} to ${e.end_date}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </AsyncBoundary>
            </section>

            {/* The boundary sits outside the field so a pending or failed
                fetch never leaves a label pointing at a trigger that is not on
                screen; an empty dropdown is not the same as "no schedules". */}
            <AsyncBoundary
              label="schedules"
              loading={schedules.isPending}
              error={schedules.error}
              empty={schedules.data?.length === 0}
              onRetry={() => void schedules.refetch()}
              skeleton={
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
                </div>
              }
              emptyIcon={ListTodo}
              emptyTitle="No schedules yet"
              emptyDescription="Create a schedule on the Schedules tab, then map it onto dates here."
            >
              {/* SelectField, not Field: Select's root renders no DOM node, so
                  the cloned id / aria-* were dropped and the label pointed at
                  an id that never existed. */}
              <SelectField
                label="Schedule"
                ids={scheduleIds}
                required
                error={errors.schedule}
              >
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger
                    {...selectFieldTriggerProps(scheduleIds, errors.schedule)}
                  >
                    <SelectValue placeholder="Pick a schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {(schedules.data ?? []).map((file) => (
                      <SelectItem key={file} value={file}>
                        {strip(file)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectField>
            </AsyncBoundary>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start" required error={errors.start}>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="End" required error={errors.end}>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>

            {formError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={addEntry.isPending}>
              Map dates
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
