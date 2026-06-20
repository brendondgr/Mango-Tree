import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useAddEquipment,
  useDeleteEquipment,
  useEquipment,
} from "@exercise/hooks/useExercise";

export function EquipmentView() {
  const equipment = useEquipment();
  const addEquipment = useAddEquipment();
  const deleteEquipment = useDeleteEquipment();

  const [name, setName] = useState("");
  const [type, setType] = useState("weight");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    addEquipment.mutate(
      {
        id: `eq_${Date.now()}`,
        name: name.trim(),
        type: type.trim() || "weight",
        weight: weight ? Number(weight) : null,
        min_weight: null,
        max_weight: null,
        unit: "lbs",
        is_bodyweight: type.trim().toLowerCase() === "bodyweight",
        color: null,
      },
      {
        onSuccess: () => {
          setName("");
          setWeight("");
        },
        onError: (err) => setError((err as Error).message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="eq-name">Name</Label>
          <Input
            id="eq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dumbbell"
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="eq-type">Type</Label>
          <Input
            id="eq-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="weight"
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="eq-weight">Weight</Label>
          <Input
            id="eq-weight"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="optional"
            className="w-28"
          />
        </div>
        <Button type="submit" disabled={addEquipment.isPending}>
          <Plus className="h-4 w-4" /> Add
        </Button>
        {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
      </form>

      {equipment.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading equipment…</p>
      ) : equipment.isError ? (
        <p className="text-sm text-destructive">{(equipment.error as Error).message}</p>
      ) : (equipment.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No equipment yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.data?.map((item) => (
            <article
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-card p-3"
            >
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.type}
                  {item.is_bodyweight
                    ? " · bodyweight"
                    : item.weight
                      ? ` · ${item.weight} ${item.unit ?? "lbs"}`
                      : ""}
                </p>
              </div>
              <ConfirmDeleteButton
                title="Delete equipment?"
                description={`"${item.name}" will be removed.`}
                onConfirm={() => deleteEquipment.mutate(item.id)}
                disabled={deleteEquipment.isPending}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
