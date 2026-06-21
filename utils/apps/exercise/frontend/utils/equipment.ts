// Equipment type metadata — icon + label + workout-type color class.
// Ported from the original WorkoutTracker state.js `equipmentTypes`.

import { Activity, Dumbbell, GitBranch, Layers, Settings, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EquipmentTypeInfo {
  key: string;
  label: string;
  icon: LucideIcon;
  colorClass: string; // "" => neutral (muted), else an .exercise-c-* class
}

export const EQUIPMENT_TYPES: EquipmentTypeInfo[] = [
  { key: "barbell", label: "Barbell", icon: Dumbbell, colorClass: "exercise-c-blue" },
  { key: "dumbbell", label: "Dumbbell", icon: Dumbbell, colorClass: "exercise-c-indigo" },
  { key: "machine", label: "Machine", icon: Settings, colorClass: "exercise-c-emerald" },
  { key: "cable", label: "Cable", icon: GitBranch, colorClass: "exercise-c-amber" },
  { key: "band", label: "Resistance Band", icon: Activity, colorClass: "exercise-c-violet" },
  { key: "bodyweight", label: "Bodyweight", icon: User, colorClass: "exercise-c-rose" },
  { key: "other", label: "Other", icon: Layers, colorClass: "" },
];

const BY_KEY = new Map(EQUIPMENT_TYPES.map((t) => [t.key, t]));

export function equipmentType(type: string | null | undefined): EquipmentTypeInfo {
  return (type && BY_KEY.get(type)) || BY_KEY.get("other")!;
}

export function equipmentDetail(eq: {
  type: string;
  weight: number | null;
  min_weight: number | null;
  max_weight: number | null;
  unit: string | null;
  is_bodyweight: boolean;
}): string {
  const unit = eq.unit ?? "lbs";
  if (eq.type === "band") {
    return `${eq.min_weight ?? 0} – ${eq.max_weight ?? 0} ${unit}`;
  }
  if (eq.is_bodyweight || eq.type === "bodyweight") {
    return eq.weight ? `Bodyweight + ${eq.weight} ${unit}` : "Bodyweight";
  }
  return eq.weight ? `${eq.weight} ${unit}` : "—";
}
