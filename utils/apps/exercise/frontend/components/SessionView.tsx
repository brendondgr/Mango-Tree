import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";

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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { cn } from "@/lib/utils";
import { useAddLog, useEquipment } from "@exercise/hooks/useExercise";
import { equipmentWeight, sessionToLog, sessionVolume } from "@exercise/utils/session";
import { CARD } from "@exercise/utils/ui";

function clock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Compact stepper button — 44px on a phone, desktop scale at `app:`. */
const STEP_BUTTON = [
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
  "text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
  "app:h-9 app:w-9",
].join(" ");

export function SessionView() {
  const session = useWorkspaceStore((s) => s.exerciseSession);
  const update = useWorkspaceStore((s) => s.updateSessionExercise);
  const endSession = useWorkspaceStore((s) => s.endExerciseSession);
  const setView = useWorkspaceStore((s) => s.setExerciseView);
  const addLog = useAddLog();
  // Keep the query, not just its data: a picker that renders "No equipment
  // added yet" while the fetch is in flight — or after it failed — tells a
  // user mid-session that their gear is gone and leaves them no way back.
  const equipmentQuery = useEquipment();
  const equipment = equipmentQuery.data ?? [];

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
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-foreground @[48rem]:text-2xl">
            {session.workoutName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Active session · {doneCount}/{session.exercises.length} done · vol{" "}
            {sessionVolume(session).toLocaleString()}
          </p>
        </div>
        <p
          className={cn(
            CARD,
            "px-4 py-2 font-mono text-xl font-bold tabular-nums text-primary-emphasis",
          )}
        >
          <span className="sr-only">Elapsed </span>
          {clock(elapsed)}
        </p>
      </header>

      <ul className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
        {session.exercises.map((ex, i) => (
          <li
            key={ex.id}
            data-enter
            style={{ "--i": i } as never}
            className={cn(
              CARD,
              "flex flex-col gap-3 p-4 transition-colors",
              ex.done && "border-primary/40 bg-surface-1",
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={
                  ex.done ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`
                }
                aria-pressed={ex.done}
                onClick={() => update(i, { done: !ex.done })}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "app:h-9 app:w-9",
                  ex.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent hover:border-primary/60",
                )}
              >
                <Check aria-hidden className="h-4 w-4" />
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

            <div className="grid grid-cols-1 gap-3 @[26rem]:grid-cols-2 @[52rem]:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor={`reps-${ex.id}`}>Reps</Label>
                <div className="flex items-center rounded-[var(--radius-sm)] border border-border">
                  <button
                    type="button"
                    aria-label={`Fewer reps for ${ex.name}`}
                    className={STEP_BUTTON}
                    onClick={() =>
                      update(i, { actualReps: Math.max(0, ex.actualReps - 1) })
                    }
                  >
                    <Minus aria-hidden className="h-4 w-4" />
                  </button>
                  <input
                    id={`reps-${ex.id}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={ex.actualReps}
                    onChange={(e) =>
                      update(i, {
                        actualReps: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full min-w-0 flex-1 bg-transparent text-center text-base font-semibold tabular-nums outline-none [appearance:textfield] app:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label={`More reps for ${ex.name}`}
                    className={STEP_BUTTON}
                    onClick={() => update(i, { actualReps: ex.actualReps + 1 })}
                  >
                    <Plus aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Field label="Weight (lb)" htmlFor={`w-${ex.id}`}>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={ex.weight}
                  onChange={(e) => update(i, { weight: Number(e.target.value) || 0 })}
                />
              </Field>

              <div className="space-y-1.5">
                <Label htmlFor={`eq-${ex.id}`}>Equipment</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      id={`eq-${ex.id}`}
                      type="button"
                      className={cn(
                        "flex h-11 w-full items-center gap-1.5 rounded-[var(--radius-sm)]",
                        "border border-border bg-transparent px-3 text-base transition-colors",
                        "hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "app:h-9 app:text-sm",
                      )}
                    >
                      <span
                        className={cn(
                          "flex-1 truncate text-left",
                          ex.equipmentIds.length
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {equipmentLabel(ex.equipmentIds)}
                      </span>
                      <ChevronDown
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-64 w-56 overflow-y-auto"
                  >
                    {/* Error, then loading, then empty — the same precedence
                        as AsyncBoundary, inlined because a full EmptyState
                        does not fit inside a menu. */}
                    {equipmentQuery.isError ? (
                      <>
                        <DropdownMenuLabel className="flex items-start gap-1.5 font-normal text-destructive">
                          <AlertCircle
                            aria-hidden
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span>Couldn&apos;t load your equipment.</span>
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            void equipmentQuery.refetch();
                          }}
                        >
                          <RefreshCw aria-hidden />
                          Try again
                        </DropdownMenuItem>
                      </>
                    ) : equipmentQuery.isLoading ? (
                      <div className="space-y-2 p-2" aria-busy="true">
                        <span className="sr-only">Loading your equipment…</span>
                        {Array.from({ length: 3 }, (_, k) => (
                          <Skeleton key={k} className="h-5" />
                        ))}
                      </div>
                    ) : equipment.length === 0 ? (
                      <DropdownMenuItem disabled>
                        No equipment added yet
                      </DropdownMenuItem>
                    ) : (
                      equipment.map((eq) => (
                        <DropdownMenuCheckboxItem
                          key={eq.id}
                          checked={ex.equipmentIds.includes(eq.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={() =>
                            toggleEquipment(i, ex.equipmentIds, eq.id)
                          }
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

              <Field label="Note" htmlFor={`n-${ex.id}`}>
                <Input
                  value={ex.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>

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
                Your progress for this workout won&apos;t be saved to history.
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
        <p role="alert" className="shrink-0 pt-2 text-center text-sm text-destructive">
          {(addLog.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}
