import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

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
import type { DirectEvent } from "@/types/calendar";

import {
  useAddDirectEvent,
  useDeleteDirectEvent,
  useUpdateDirectEvent,
} from "../hooks/useCalendar";

const COMMON_TYPES = [
  "work", "class", "exercise", "food", "commute", "social", "health", "personal", "other",
];

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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
  }, [open, event, defaultDate]);

  const pending = add.isPending || update.isPending || remove.isPending;

  async function handleSave() {
    setError(null);
    const payload = { date, title, type: type || "other", start, end, sub };
    try {
      if (editing) {
        await update.mutateAsync({ index: event!._direct_index as number, event: payload });
      } else {
        await add.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setError(null);
    try {
      await remove.mutateAsync(event!._direct_index as number);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            One-off events appear on the calendar and take priority over the schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cal-ev-title">Title</Label>
            <Input
              id="cal-ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Doctor's appointment"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ev-date">Date</Label>
              <Input
                id="cal-ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ev-type">Type</Label>
              <Input
                id="cal-ev-type"
                list="cal-ev-types"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
              <datalist id="cal-ev-types">
                {COMMON_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ev-start">Start</Label>
              <Input
                id="cal-ev-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cal-ev-end">End</Label>
              <Input
                id="cal-ev-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cal-ev-sub">Note (optional)</Label>
            <Input
              id="cal-ev-sub"
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              placeholder="Room 204"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending || !title || !date}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
