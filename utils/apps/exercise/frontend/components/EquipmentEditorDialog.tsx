import { useEffect, useState } from "react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddEquipment, useUpdateEquipment } from "@exercise/hooks/useExercise";
import { EQUIPMENT_TYPES } from "@exercise/utils/equipment";
import type { Equipment } from "@/types/exercise";

/**
 * Default band colour. This is a *data* value persisted on the equipment record
 * (bands are identified in the real world by their colour), not a theme token —
 * which is why it is a literal rather than a `--category-*` binding.
 */
const DEFAULT_BAND_COLOR = "#3b82f6";

interface EquipmentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

export function EquipmentEditorDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentEditorDialogProps) {
  const add = useAddEquipment();
  const update = useUpdateEquipment();

  const [name, setName] = useState("");
  const [type, setType] = useState("dumbbell");
  const [unit, setUnit] = useState("lbs");
  const [weight, setWeight] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [color, setColor] = useState(DEFAULT_BAND_COLOR);
  const { errors, formError, setFieldError, setFormError, clear } =
    useFormErrors<"name">();

  useEffect(() => {
    if (!open) return;
    setName(equipment?.name ?? "");
    setType(equipment?.type ?? "dumbbell");
    setUnit(equipment?.unit ?? "lbs");
    setWeight(equipment?.weight == null ? "" : String(equipment.weight));
    setMinWeight(equipment?.min_weight == null ? "" : String(equipment.min_weight));
    setMaxWeight(equipment?.max_weight == null ? "" : String(equipment.max_weight));
    setIsBodyweight(equipment?.is_bodyweight ?? false);
    setColor(equipment?.color ?? DEFAULT_BAND_COLOR);
    clear();
  }, [open, equipment, clear]);

  const numOrNull = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const isPending = add.isPending || update.isPending;
  const isBand = type === "band";

  const handleSave = () => {
    clear();
    if (!name.trim()) {
      setFieldError("name", "Please give the equipment a name.");
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
      onError: (err: unknown) => setFormError((err as Error).message),
    };
    if (equipment) update.mutate({ id: equipment.id, equipment: payload }, onDone);
    else add.mutate(payload, onDone);
  };

  // Radix Select renders its trigger through a portal-free button, but the
  // Root itself has no DOM node — so the label is wired to the trigger by id
  // rather than by wrapping the Root in `Field`.
  const unitField = (
    <div className="space-y-1.5">
      <Label htmlFor="eq-unit">Unit</Label>
      <Select value={unit} onValueChange={setUnit}>
        <SelectTrigger id="eq-unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lbs">lbs</SelectItem>
          <SelectItem value="kg">kg</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {equipment ? "Edit Equipment" : "New Equipment"}
          </DialogTitle>
          <DialogDescription>
            Track gear and loads available for your workouts.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Adjustable Dumbbell"
              />
            </Field>

            <div className="space-y-1.5">
              <Label htmlFor="eq-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="eq-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isBand ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Min weight">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={minWeight}
                      onChange={(e) => setMinWeight(e.target.value)}
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Max weight">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={maxWeight}
                      onChange={(e) => setMaxWeight(e.target.value)}
                      placeholder="—"
                    />
                  </Field>
                </div>
                <div className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">{unitField}</div>
                  <Field label="Band colour" className="shrink-0">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-11 w-16 cursor-pointer rounded-[var(--radius-sm)] border border-border bg-transparent p-1 app:h-9 app:w-12"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={type === "bodyweight" ? "Added weight" : "Weight"}
                    hint="Optional"
                  >
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="—"
                    />
                  </Field>
                  {unitField}
                </div>
                {type !== "bodyweight" ? (
                  // The label is the target, so the tap area is the full row
                  // rather than the 16px box the checkbox draws.
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={isBodyweight}
                      onChange={(e) => setIsBodyweight(e.target.checked)}
                      className="h-5 w-5 shrink-0 rounded border-border accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    Uses bodyweight
                  </label>
                ) : null}
              </>
            )}
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
            disabled={isPending}
          >
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
