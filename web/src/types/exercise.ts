// Types for the exercise app API. Mirrors utils/apps/exercise/shared/schemas.py.

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;
  weight: number | null;
  goal: number | null;
}

export interface Workout {
  id: string;
  name: string;
  color: string;
  exercises: Exercise[];
}

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  workouts: Record<string, string[]>;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  weight: number | null;
  min_weight: number | null;
  max_weight: number | null;
  unit: string | null;
  is_bodyweight: boolean;
  color: string | null;
}

export interface HistoryLog {
  id: string;
  workout_id: string;
  date: string;
  start_time: string | null;
  duration: number;
  volume: number;
  notes: string | null;
  exercises: Array<Record<string, unknown>>;
}

export interface ListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
}

export interface StravaSyncSummary {
  fetched: number;
  imported: number;
  skipped: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}
