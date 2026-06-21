import { useState, type FormEvent } from "react";
import { Dumbbell, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useAddEquipment,
  useDeleteEquipment,
  useEquipment,
} from "@exercise/hooks/useExercise";

const TYPE_COLOR: Record<string, string> = {
  barbell: "ex-c-blue",
  dumbbell: "ex-c-indigo",
  machine: "ex-c-emerald",
  cable: "ex-c-amber",
  band: "ex-c-violet",
  bodyweight: "ex-c-rose",
};

function typeColor(type: string): string {
  return TYPE_COLOR[type.toLowerCase()] ?? "ex-c-indigo";
}

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
    <div className="ex-fade-in flex flex-col gap-6">
      <header>
        <h2 className="ex-gradient-text text-2xl font-bold tracking-tight">Equipment Manager</h2>
        <p className="text-sm text-muted-foreground">Manage your available gear</p>
      </header>

      <form onSubmit={handleAdd} className="ex-glass flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="eq-name" className="text-xs font-semibold text-muted-foreground">Name</label>
          <input id="eq-name" className="ex-input w-44" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dumbbell" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="eq-type" className="text-xs font-semibold text-muted-foreground">Type</label>
          <input id="eq-type" className="ex-input w-36" value={type} onChange={(e) => setType(e.target.value)} placeholder="dumbbell" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="eq-weight" className="text-xs font-semibold text-muted-foreground">Weight</label>
          <input id="eq-weight" type="number" className="ex-input w-28" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="optional" />
        </div>
        <Button type="submit" className="ex-gradient ex-glow border-0" disabled={addEquipment.isPending}>
          <Plus className="h-4 w-4" /> Add Item
        </Button>
        {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
      </form>

      {equipment.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading equipment…</p>
      ) : equipment.isError ? (
        <p className="text-sm text-destructive">{(equipment.error as Error).message}</p>
      ) : (equipment.data?.length ?? 0) === 0 ? (
        <div className="ex-glass flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-10 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No equipment yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.data?.map((item) => {
            const colorClass = typeColor(item.type);
            return (
              <article
                key={item.id}
                className={cn(
                  "ex-glass ex-card ex-railed flex items-center justify-between gap-2 rounded-[var(--radius-lg)] p-4 pl-5",
                  colorClass,
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("ex-bg flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-white", colorClass)}>
                    <Dumbbell className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {item.type}
                      {item.is_bodyweight
                        ? " · bodyweight"
                        : item.weight
                          ? ` · ${item.weight} ${item.unit ?? "lbs"}`
                          : ""}
                    </p>
                  </div>
                </div>
                <ConfirmDeleteButton
                  title="Delete equipment?"
                  description={`"${item.name}" will be removed.`}
                  onConfirm={() => deleteEquipment.mutate(item.id)}
                  disabled={deleteEquipment.isPending}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
