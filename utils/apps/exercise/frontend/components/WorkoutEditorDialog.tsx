import { useEffect, useId, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { useSaveWorkout } from "@exercise/hooks/useExercise";
import { CARD } from "@exercise/utils/ui";
import type { Exercise, Workout } from "@/types/exercise";

const COLORS: Array<{ key: string; label: string; className: string }> = [
  { key: "blue", label: "Blue", className: "exercise-c-blue" },
  { key: "indigo", label: "Indigo", className: "exercise-c-indigo" },
  { key: "violet", label: "Violet", className: "exercise-c-violet" },
  { key: "rose", label: "Rose", className: "exercise-c-rose" },
  { key: "emerald", label: "Emerald", className: "exercise-c-emerald" },
  { key: "amber", label: "Amber", className: "exercise-c-amber" },
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

export function WorkoutEditorDialog({
  open,
  onOpenChange,
  workout,
}: WorkoutEditorDialogProps) {
  const save = useSaveWorkout();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const colorLabelId = useId();
  const { errors, formError, setFieldError, setFormError, clear } =
    useFormErrors<"name" | "exercises">();

  useEffect(() => {
    if (!open) return;
    setName(workout?.name ?? "");
    setColor(workout?.color ?? "blue");
    setExercises(workout ? workout.exercises.map((e) => ({ ...e })) : [newExercise()]);
    clear();
  }, [open, workout, clear]);

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
    clear();
    const cleaned = exercises
      .map((e) => ({ ...e, name: e.name.trim() }))
      .filter((e) => e.name.length > 0);
    if (!name.trim()) {
      setFieldError("name", "Please give the workout a name.");
      return;
    }
    if (cleaned.length === 0) {
      setFieldError("exercises", "Add at least one exercise (with a name).");
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
      onError: (err) => setFormError((err as Error).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{workout ? "Edit Workout" : "New Workout"}</DialogTitle>
          <DialogDescription>
            Name the program, pick a colour label, and define its exercises.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5" style={{ containerType: "inline-size" }}>
            <Field label="Workout name" required error={errors.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Upper Body Power"
              />
            </Field>

            <div className="space-y-2">
              <p id={colorLabelId} className="text-sm font-medium text-foreground">
                Colour label
              </p>
              <div
                role="group"
                aria-labelledby={colorLabelId}
                className="flex flex-wrap gap-2"
              >
                {COLORS.map((c) => {
                  const selected = color === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={selected}
                      aria-label={c.label}
                      onClick={() => setColor(c.key)}
                      className={cn(
                        // 44px on compact, stepping down to the denser desktop
                        // scale — the swatch itself stays the same size.
                        "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
                        "border transition-colors app:h-9 app:w-9",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-foreground bg-surface-2"
                          : "border-transparent hover:bg-surface-2",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "exercise-bg flex h-6 w-6 items-center justify-center rounded-full text-primary-foreground",
                          c.className,
                        )}
                      >
                        {/* Selection is signalled by a mark as well as by the
                            ring, so it does not rely on colour alone. */}
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">Exercises</h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExercises((list) => [...list, newExercise()])}
                >
                  <Plus className="h-4 w-4" /> Add exercise
                </Button>
              </div>

              {errors.exercises ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors.exercises}
                </p>
              ) : null}

              <ul className="space-y-2">
                {exercises.map((ex, i) => (
                  <li key={ex.id} className={cn(CARD, "space-y-3 p-3")}>
                    <div className="flex items-end gap-2">
                      <Field
                        label={`Exercise ${i + 1} name`}
                        className="min-w-0 flex-1"
                      >
                        <Input
                          value={ex.name}
                          onChange={(e) => patch(i, { name: e.target.value })}
                          placeholder="e.g. Bench Press"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove exercise ${i + 1}`}
                        onClick={() =>
                          setExercises((list) => list.filter((_, idx) => idx !== i))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 @[26rem]:grid-cols-3 @[40rem]:grid-cols-5">
                      {(
                        [
                          { key: "sets", label: "Sets", value: String(ex.sets) },
                          { key: "reps", label: "Reps", value: String(ex.reps) },
                          {
                            key: "weight",
                            label: "Weight",
                            value: ex.weight == null ? "" : String(ex.weight),
                          },
                          { key: "rest", label: "Rest (s)", value: String(ex.rest) },
                          {
                            key: "goal",
                            label: "Goal",
                            value: ex.goal == null ? "" : String(ex.goal),
                          },
                        ] as const
                      ).map((field) => (
                        <Field key={field.key} label={field.label}>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={field.value}
                            placeholder={
                              field.key === "weight" || field.key === "goal"
                                ? "—"
                                : undefined
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (field.key === "weight")
                                patch(i, { weight: numOrNull(v) });
                              else if (field.key === "goal")
                                patch(i, { goal: numOrNull(v) });
                              else
                                patch(i, {
                                  [field.key]: num(v),
                                } as Partial<Exercise>);
                            }}
                          />
                        </Field>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </DialogBody>

        {formError ? (
          <p role="alert" className="shrink-0 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
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
