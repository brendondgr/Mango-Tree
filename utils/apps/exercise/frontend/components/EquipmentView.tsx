import { useState } from "react";
import { Dumbbell, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { EquipmentEditorDialog } from "@exercise/components/EquipmentEditorDialog";
import { useDeleteEquipment, useEquipment } from "@exercise/hooks/useExercise";
import { equipmentDetail, equipmentType } from "@exercise/utils/equipment";
import type { Equipment } from "@/types/exercise";

export function EquipmentView() {
  const equipment = useEquipment();
  const deleteEquipment = useDeleteEquipment();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (item: Equipment) => {
    setEditing(item);
    setEditorOpen(true);
  };

  const items = equipment.data ?? [];

  return (
    <div className="exercise-fade-in flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Equipment Manager</h2>
          <p className="text-sm text-muted-foreground">Manage your available gear</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Equipment
        </Button>
      </header>

      {equipment.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading equipment…</p>
      ) : equipment.isError ? (
        <p className="text-sm text-destructive">{(equipment.error as Error).message}</p>
      ) : items.length === 0 ? (
        <div className="exercise-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No equipment yet. Add the gear you train with.</p>
          <Button onClick={openNew} variant="outline" size="sm">
            <Plus className="h-4 w-4" /> New Equipment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const info = equipmentType(item.type);
            const Icon = info.icon;
            const useBandColor = item.type === "band" && item.color;
            return (
              <article
                key={item.id}
                className={cn(
                  "exercise-glass exercise-card exercise-railed flex items-center justify-between gap-2 rounded-[var(--radius-lg)] p-4 pl-5",
                  info.colorClass,
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "exercise-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white",
                      info.colorClass,
                    )}
                    style={useBandColor ? { background: item.color as string } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {equipmentDetail(item)} · {info.label}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon" aria-label="Edit equipment" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDeleteButton
                    title="Delete equipment?"
                    description={`"${item.name}" will be removed.`}
                    onConfirm={() => deleteEquipment.mutate(item.id)}
                    disabled={deleteEquipment.isPending}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <EquipmentEditorDialog open={editorOpen} onOpenChange={setEditorOpen} equipment={editing} />
    </div>
  );
}
