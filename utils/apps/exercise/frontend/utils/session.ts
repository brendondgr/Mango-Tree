// Helpers for the live workout session player.

import type { ExerciseSession } from "@/app/stores/workspaceStore";
import type { Equipment, HistoryLog, Workout } from "@/types/exercise";

/** Summed load of the selected equipment; bands contribute their max weight. */
export function equipmentWeight(ids: string[], equipment: Equipment[]): number {
  let total = 0;
  for (const id of ids) {
    const eq = equipment.find((e) => e.id === id);
    if (!eq) continue;
    total += eq.type === "band" ? (eq.max_weight ?? 0) : (eq.weight ?? eq.max_weight ?? 0);
  }
  return total;
}

/** Seed a live session from a workout template. Runs client-side (Date.now ok). */
export function buildSession(workout: Workout): ExerciseSession {
  return {
    workoutId: workout.id,
    workoutName: workout.name,
    startedAt: Date.now(),
    exercises: workout.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      plannedSets: ex.sets,
      plannedReps: ex.reps,
      plannedWeight: ex.weight,
      done: false,
      actualReps: ex.reps,
      weight: ex.weight ?? 0,
      equipmentIds: [],
      note: "",
    })),
  };
}

/** Volume = Σ over completed exercises of weight × actual reps × planned sets. */
export function sessionVolume(session: ExerciseSession): number {
  return session.exercises.reduce(
    (sum, ex) => (ex.done ? sum + (ex.weight || 0) * (ex.actualReps || 0) * (ex.plannedSets || 0) : sum),
    0,
  );
}

export function sessionToLog(session: ExerciseSession): HistoryLog {
  const duration = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
  return {
    id: `hist_${Date.now()}`,
    workout_id: session.workoutId,
    date: new Date().toISOString(),
    start_time: new Date(session.startedAt).toISOString(),
    duration,
    volume: sessionVolume(session),
    notes: "Completed via session player",
    exercises: session.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.plannedSets,
      reps: ex.plannedReps,
      actualReps: ex.actualReps,
      weight: ex.weight,
      equipmentIds: ex.equipmentIds,
      note: ex.note,
      done: ex.done,
    })),
  };
}
