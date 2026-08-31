import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

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
import type { DirectEvent } from "@/types/calendar";

import {
  useAddDirectEvent,
  useDeleteDirectEvent,
  useUpdateDirectEvent,
} from "../hooks/useCalendar";

const COMMON_TYPES = [
  "work", "class", "exercise", "food", "commute", "social", "health", "personal", "other",
];

type FieldName = "title" | "date" | "time";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing, the existing event (must carry `_direct_index`). */
  event?: DirectEvent | null;
  /** Prefill the date for a new event. */
  defaultDate?: string;
}

export function DirectEventDialog({ open, onOpenChange, event, defaultDate }: Props) {
  const add = useAddDirectEvent();
  const update = useUpdateDirectEvent();
  const remove = useDeleteDirectEvent();

  const editing = event != null && event._direct_index != null;

  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("other");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [sub, setSub] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { errors, formError, setErrors, setFormError, clear } =
    useFormErrors<FieldName>();

  useEffect(() => {
    if (!open) return;
    clear();
    setConfirmDelete(false);
    if (event) {
      setDate(event.date);
      setTitle(event.title);
      setType(event.type || "other");
      setStart(event.start);
      setEnd(event.end);
      setSub(event.sub ?? "");
    } else {
      setDate(defaultDate ?? "");
      setTitle("");
      setType("other");
      setStart("09:00");
      setEnd("10:00");
      setSub("");
    }
  }, [open, event, defaultDate, clear]);

  const pending = add.isPending || update.isPending || remove.isPending;

  function validate(): boolean {
    const next: Partial<Record<FieldName, string>> = {};
    if (!title.trim()) next.title = "Give the event a title.";
    if (!date) next.date = "Pick a date.";
    // Kept, unlike the schedule form: `_validate_direct_event` in the backend
    // rejects `start >= end` outright, so a dated event cannot run past
    // midnight there either and relaxing this would only move the same refusal
    // to a round-trip.
    if (start >= end) next.time = "The end time must be after the start time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    const payload = { date, title, type: type || "other", start, end, sub };
    try {
      if (editing) {
        await update.mutateAsync({ index: event!._direct_index as number, event: payload });
      } else {
        await add.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setFormError(null);
    try {
      await remove.mutateAsync(event!._direct_index as number);
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      setConfirmDelete(false);
      setFormError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              One-off events appear on the calendar and take priority over the schedule.
            </DialogDescription>
          </DialogHeader>

          {/* The form lives inside DialogBody so the title above it and the Save
              button below it stay pinned; at 360px this dialog is taller than
              the viewport, and without it the footer was simply unreachable. */}
          <form id="cal-direct-event" onSubmit={handleSave} className="contents">
            <DialogBody className="space-y-3">
              <Field label="Title" required error={errors.title}>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Doctor's appointment"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date" required error={errors.date}>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field label="Type" hint="Sets the color on the grid.">
                  <Input
                    list="cal-ev-types"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  />
                </Field>
                <datalist id="cal-ev-types">
                  {COMMON_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
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
                  <Input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Note" hint="Optional — a room, a link, a reminder.">
                <Input
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  placeholder="Room 204"
                />
              </Field>

              {formError ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {formError}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter className="sm:justify-between">
              {/* Confirming inline rather than in a second modal: stacking one
                  dialog on another moves the focus trap twice for a decision
                  that fits in the footer it was triggered from. */}
              {editing && confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2" role="alert">
                  <span className="text-sm font-medium text-foreground">
                    Delete this event?
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => void handleDelete()}
                  >
                    Delete
                  </Button>
                </div>
              ) : editing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {editing ? "Save" : "Add"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
