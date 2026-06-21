import { useEffect, useState } from "react";

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
import { useAddEquipment, useUpdateEquipment } from "@exercise/hooks/useExercise";
import { EQUIPMENT_TYPES } from "@exercise/utils/equipment";
import type { Equipment } from "@/types/exercise";

interface EquipmentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

export function EquipmentEditorDialog({ open, onOpenChange, equipment }: EquipmentEditorDialogProps) {
  const add = useAddEquipment();
  const update = useUpdateEquipment();

  const [name, setName] = useState("");
  const [type, setType] = useState("dumbbell");
  const [unit, setUnit] = useState("lbs");
  const [weight, setWeight] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(equipment?.name ?? "");
    setType(equipment?.type ?? "dumbbell");
    setUnit(equipment?.unit ?? "lbs");
    setWeight(equipment?.weight == null ? "" : String(equipment.weight));
    setMinWeight(equipment?.min_weight == null ? "" : String(equipment.min_weight));
    setMaxWeight(equipment?.max_weight == null ? "" : String(equipment.max_weight));
    setIsBodyweight(equipment?.is_bodyweight ?? false);
    setColor(equipment?.color ?? "#3b82f6");
    setError(null);
  }, [open, equipment]);

  const numOrNull = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const isPending = add.isPending || update.isPending;
  const isBand = type === "band";

  const handleSave = () => {
    setError(null);
    if (!name.trim()) {
      setError("Please give the equipment a name.");
      return;
    }
    const payload: Equipment = {
      id: equipment?.id ?? `eq_${Date.now()}`,
      name: name.trim(),
      type,
      unit,
      is_bodyweight: isBodyweight || type === "bodyweight",
      color: isBand ? color : null,
      weight: isBand ? null : numOrNull(weight),
      min_weight: isBand ? numOrNull(minWeight) : null,
      max_weight: isBand ? numOrNull(maxWeight) : null,
    };
    const onDone = {
      onSuccess: () => onOpenChange(false),
      onError: (err: unknown) => setError((err as Error).message),
    };
    if (equipment) update.mutate({ id: equipment.id, equipment: payload }, onDone);
    else add.mutate(payload, onDone);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exercise-app max-w-md">
        <DialogHeader>
          <DialogTitle>{equipment ? "Edit Equipment" : "New Equipment"}</DialogTitle>
          <DialogDescription>Track gear and loads available for your workouts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eq-name">Name</Label>
            <Input
              id="eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Adjustable Dumbbell"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-type">Type</Label>
            <select
              id="eq-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="exercise-input capitalize"
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isBand ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="eq-min">Min weight</Label>
                  <Input id="eq-min" type="number" min={0} value={minWeight} onChange={(e) => setMinWeight(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-max">Max weight</Label>
                  <Input id="eq-max" type="number" min={0} value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder="—" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="eq-unit">Unit</Label>
                  <select id="eq-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="exercise-input">
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-color">Band color</Label>
                  <input
                    id="eq-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-[var(--radius-sm)] border border-border bg-transparent"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="eq-weight">{type === "bodyweight" ? "Added weight" : "Weight"}</Label>
                  <Input id="eq-weight" type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="optional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-unit">Unit</Label>
                  <select id="eq-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="exercise-input">
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              {type !== "bodyweight" ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isBodyweight}
                    onChange={(e) => setIsBodyweight(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                  />
                  Uses bodyweight
                </label>
              ) : null}
            </>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
