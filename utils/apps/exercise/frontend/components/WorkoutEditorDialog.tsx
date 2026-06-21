import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { useSaveWorkout } from "@exercise/hooks/useExercise";
import type { Exercise, Workout } from "@/types/exercise";

const COLORS: Array<{ key: string; className: string }> = [
  { key: "blue", className: "exercise-c-blue" },
  { key: "indigo", className: "exercise-c-indigo" },
  { key: "violet", className: "exercise-c-violet" },
  { key: "rose", className: "exercise-c-rose" },
  { key: "emerald", className: "exercise-c-emerald" },
  { key: "amber", className: "exercise-c-amber" },
];

function newExercise(): Exercise {
  return {
    id: `ex_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: "",
    sets: 3,
    reps: 10,
    rest: 60,
    weight: null,
    goal: null,
  };
}

interface WorkoutEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: Workout | null;
}

export function WorkoutEditorDialog({ open, onOpenChange, workout }: WorkoutEditorDialogProps) {
  const save = useSaveWorkout();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(workout?.name ?? "");
    setColor(workout?.color ?? "blue");
    setExercises(workout ? workout.exercises.map((e) => ({ ...e })) : [newExercise()]);
    setError(null);
  }, [open, workout]);

  const patch = (index: number, changes: Partial<Exercise>) =>
    setExercises((list) => list.map((e, i) => (i === index ? { ...e, ...changes } : e)));

  const num = (value: string): number => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const numOrNull = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = () => {
    setError(null);
    const cleaned = exercises
      .map((e) => ({ ...e, name: e.name.trim() }))
      .filter((e) => e.name.length > 0);
    if (!name.trim()) {
      setError("Please give the workout a name.");
      return;
    }
    if (cleaned.length === 0) {
      setError("Add at least one exercise (with a name).");
      return;
    }
    const payload: Workout = {
      id: workout?.id ?? `wk_${Date.now()}`,
      name: name.trim(),
      color,
      exercises: cleaned,
    };
    save.mutate(payload, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => setError((err as Error).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exercise-app max-w-2xl">
        <DialogHeader>
          <DialogTitle>{workout ? "Edit Workout" : "New Workout"}</DialogTitle>
          <DialogDescription>
            Name the program, pick a color label, and define its exercises.
          </DialogDescription>
        </DialogHeader>

        <div className="exercise-scroll -mr-2 max-h-[60vh] space-y-5 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="wk-name">Workout name</Label>
            <Input
              id="wk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Upper Body Power"
            />
          </div>

          <div className="space-y-2">
            <Label>Color label</Label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={c.key}
                  aria-pressed={color === c.key}
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "exercise-bg h-8 w-8 rounded-full transition-transform",
                    c.className,
                    color === c.key
                      ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card"
                      : "opacity-80 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Exercises</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExercises((list) => [...list, newExercise()])}
              >
                <Plus className="h-4 w-4" /> Add exercise
              </Button>
            </div>

            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <div key={ex.id} className="exercise-glass space-y-2 rounded-[var(--radius-md)] p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ex.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      placeholder={`Exercise ${i + 1} name`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove exercise"
                      onClick={() => setExercises((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(
                      [
                        { key: "sets", label: "Sets", value: String(ex.sets) },
                        { key: "reps", label: "Reps", value: String(ex.reps) },
                        { key: "weight", label: "Weight", value: ex.weight == null ? "" : String(ex.weight) },
                        { key: "rest", label: "Rest (s)", value: String(ex.rest) },
                        { key: "goal", label: "Goal", value: ex.goal == null ? "" : String(ex.goal) },
                      ] as const
                    ).map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          placeholder={field.key === "weight" || field.key === "goal" ? "—" : undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (field.key === "weight") patch(i, { weight: numOrNull(v) });
                            else if (field.key === "goal") patch(i, { goal: numOrNull(v) });
                            else patch(i, { [field.key]: num(v) } as Partial<Exercise>);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Workout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
