import { useEffect, useState } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { cn } from "@/lib/utils";
import { useAddLog, useEquipment } from "@exercise/hooks/useExercise";
import { equipmentWeight, sessionToLog, sessionVolume } from "@exercise/utils/session";

function clock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function SessionView() {
  const session = useWorkspaceStore((s) => s.exerciseSession);
  const update = useWorkspaceStore((s) => s.updateSessionExercise);
  const endSession = useWorkspaceStore((s) => s.endExerciseSession);
  const setView = useWorkspaceStore((s) => s.setExerciseView);
  const addLog = useAddLog();
  const equipment = useEquipment().data ?? [];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!session) return null;

  const elapsed = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const doneCount = session.exercises.filter((e) => e.done).length;

  const toggleEquipment = (index: number, ids: string[], id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    update(index, { equipmentIds: next, weight: equipmentWeight(next, equipment) });
  };
  const equipmentLabel = (ids: string[]) =>
    equipment
      .filter((e) => ids.includes(e.id))
      .map((e) => e.name)
      .join(", ") || "None";

  const finish = () => {
    addLog.mutate(sessionToLog(session), {
      onSuccess: () => {
        endSession();
        setView("history");
      },
    });
  };

  return (
    <div className="exercise-fade-in flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{session.workoutName}</h2>
          <p className="text-sm text-muted-foreground">
            Active session · {doneCount}/{session.exercises.length} done · vol {sessionVolume(session).toLocaleString()}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-card px-4 py-2 font-mono text-xl font-bold tabular-nums text-primary">
          {clock(elapsed)}
        </div>
      </header>

      <div className="exercise-scroll -mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
        {session.exercises.map((ex, i) => (
          <div
            key={ex.id}
            className={cn(
              "exercise-glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-4 transition-colors",
              ex.done && "border-primary/40",
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={ex.done ? "Mark not done" : "Mark done"}
                aria-pressed={ex.done}
                onClick={() => update(i, { done: !ex.done })}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  ex.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent hover:border-primary/60",
                )}
              >
                <Check className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h3
                  className={cn(
                    "truncate font-semibold",
                    ex.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {ex.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Target: {ex.plannedSets} × {ex.plannedReps}
                  {ex.plannedWeight ? ` @ ${ex.plannedWeight} lb` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reps</Label>
                <div className="flex h-9 items-center rounded-[var(--radius-sm)] border border-border">
                  <button
                    type="button"
                    aria-label="Fewer reps"
                    className="flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => update(i, { actualReps: Math.max(0, ex.actualReps - 1) })}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label="Reps"
                    value={ex.actualReps}
                    onChange={(e) =>
                      update(i, { actualReps: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                    className="w-full min-w-0 flex-1 bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="More reps"
                    className="flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => update(i, { actualReps: ex.actualReps + 1 })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`w-${ex.id}`} className="text-xs text-muted-foreground">Weight (lb)</Label>
                <Input
                  id={`w-${ex.id}`}
                  type="number"
                  min={0}
                  value={ex.weight}
                  onChange={(e) => update(i, { weight: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Equipment</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-transparent px-2.5 text-sm"
                    >
                      <span
                        className={cn(
                          "flex-1 truncate text-left",
                          ex.equipmentIds.length ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {equipmentLabel(ex.equipmentIds)}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
                    {equipment.length === 0 ? (
                      <DropdownMenuItem disabled>No equipment added yet</DropdownMenuItem>
                    ) : (
                      equipment.map((eq) => (
                        <DropdownMenuCheckboxItem
                          key={eq.id}
                          checked={ex.equipmentIds.includes(eq.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={() => toggleEquipment(i, ex.equipmentIds, eq.id)}
                        >
                          <span className="flex-1">{eq.name}</span>
                          <span className="ml-3 text-xs text-muted-foreground">
                            {eq.type === "band"
                              ? `${eq.min_weight ?? 0}–${eq.max_weight ?? 0}`
                              : (eq.weight ?? eq.max_weight ?? 0)}{" "}
                            {eq.unit ?? "lb"}
                          </span>
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor={`n-${ex.id}`} className="text-xs text-muted-foreground">Note</Label>
                <Input
                  id={`n-${ex.id}`}
                  value={ex.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 gap-3 pt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-1" disabled={addLog.isPending}>
              Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this session?</AlertDialogTitle>
              <AlertDialogDescription>
                Your progress for this workout won't be saved to history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep going</AlertDialogCancel>
              <AlertDialogAction
                onClick={endSession}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button className="flex-1" onClick={finish} disabled={addLog.isPending}>
          {addLog.isPending ? "Saving…" : "Finish Workout"}
        </Button>
      </footer>

      {addLog.isError ? (
        <p className="shrink-0 pt-2 text-center text-sm text-destructive">{(addLog.error as Error).message}</p>
      ) : null}
    </div>
  );
}
