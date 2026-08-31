import { useState } from "react";
import { Dumbbell, Pencil, Plus } from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { EquipmentEditorDialog } from "@exercise/components/EquipmentEditorDialog";
import { useDeleteEquipment, useEquipment } from "@exercise/hooks/useExercise";
import { equipmentDetail, equipmentType } from "@exercise/utils/equipment";
import { CARD_INTERACTIVE } from "@exercise/utils/ui";
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
    <div className="flex flex-col gap-4 @[48rem]:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground @[48rem]:text-2xl">
            Equipment Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your available gear
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Equipment
        </Button>
      </header>

      <AsyncBoundary
        loading={equipment.isLoading}
        error={equipment.error}
        empty={items.length === 0}
        onRetry={() => void equipment.refetch()}
        label="your equipment"
        skeleton={<SkeletonList count={4} />}
        emptyIcon={Dumbbell}
        emptyTitle="No equipment yet"
        emptyDescription="Add the gear you train with so sessions can pick up its load automatically."
        emptyAction={
          <Button onClick={openNew} variant="outline">
            <Plus className="h-4 w-4" /> New Equipment
          </Button>
        }
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
          {items.map((item, index) => {
            const info = equipmentType(item.type);
            const Icon = info.icon;
            // Band colour is user data persisted on the record, not a theme
            // token, so it is applied inline rather than through a category
            // class. Everything else tints from the shared --c binding.
            const bandColor = item.type === "band" ? item.color : null;
            return (
              <article
                key={item.id}
                data-enter
                style={{ "--i": index } as never}
                className={cn(
                  CARD_INTERACTIVE,
                  "exercise-railed flex items-center justify-between gap-2 p-3 pl-4",
                  info.colorClass,
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "exercise-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-primary-foreground",
                      info.colorClass,
                    )}
                    style={bandColor ? { background: bandColor } : undefined}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {equipmentDetail(item)} · {info.label}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDeleteButton
                    title="Delete equipment?"
                    description={`"${item.name}" will be removed.`}
                    label={`Delete ${item.name}`}
                    onConfirm={() => deleteEquipment.mutate(item.id)}
                    disabled={deleteEquipment.isPending}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </AsyncBoundary>

      <EquipmentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        equipment={editing}
      />
    </div>
  );
}
