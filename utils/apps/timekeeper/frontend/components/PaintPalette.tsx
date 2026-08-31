import { Brush, Check, Eraser, Palette, Tags } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { GridMode } from "@timekeeper/components/TrackerGrid";
import type { PaintOption } from "@timekeeper/utils/paints";

/**
 * Paint selection and the paint/erase mode switch.
 *
 * "Erase mode" used to be a button that cleared the selected paint, which made
 * the grid inert: every pointer-down bailed out because no paint was active,
 * and the only thing that actually erased was a right-button drag. Mode is now
 * real state with two pressed-state buttons, so erasing works from a keyboard,
 * a finger, or a mouse.
 *
 * On a narrow pane the palette becomes a Sheet picker rather than a pill wall
 * that pushes the grid off screen.
 */

interface PaintPaletteProps {
  options: PaintOption[];
  activeId: string | null;
  onSelect: (option: PaintOption) => void;
  mode: GridMode;
  onModeChange: (mode: GridMode) => void;
  /** True when the pane is too narrow for an inline pill row. */
  narrow: boolean;
  onManageCategories: () => void;
}

export function PaintPalette({
  options,
  activeId,
  onSelect,
  mode,
  onModeChange,
  narrow,
  onManageCategories,
}: PaintPaletteProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeOption = options.find((option) => option.id === activeId) ?? null;

  if (options.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-card shadow-xs">
        <EmptyState
          compact
          icon={Tags}
          title="No paints yet"
          description="Add a category and at least one subcategory, then come back to paint the day."
          action={
            <Button variant="outline" onClick={onManageCategories}>
              <Tags className="h-4 w-4" />
              Manage categories
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Paint
        </h3>
        <div
          role="group"
          aria-label="Grid mode"
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1"
        >
          <Button
            variant={mode === "paint" ? "default" : "ghost"}
            aria-pressed={mode === "paint"}
            onClick={() => onModeChange("paint")}
            className="px-3"
          >
            <Brush className="h-4 w-4" />
            Paint
          </Button>
          <Button
            variant={mode === "erase" ? "default" : "ghost"}
            aria-pressed={mode === "erase"}
            onClick={() => onModeChange("erase")}
            className="px-3"
          >
            <Eraser className="h-4 w-4" />
            Erase
          </Button>
        </div>
      </div>

      {narrow ? (
        <>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setPickerOpen(true)}
          >
            {activeOption ? (
              <Swatch color={activeOption.color} />
            ) : (
              <Palette className="h-4 w-4" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">
              {activeOption ? activeOption.label : "Choose a paint"}
            </span>
          </Button>

          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetContent side="bottom" className="max-h-[70dvh]">
              <SheetHeader>
                <SheetTitle>Choose a paint</SheetTitle>
              </SheetHeader>
              <SheetBody>
                <ul className="flex flex-col gap-1">
                  {options.map((option, index) => (
                    <li key={option.id} data-enter style={{ "--i": index } as never}>
                      <button
                        type="button"
                        aria-pressed={option.id === activeId}
                        onClick={() => {
                          onSelect(option);
                          setPickerOpen(false);
                        }}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm",
                          "transition-colors hover:bg-surface-2",
                          option.id === activeId && "bg-surface-2 font-medium",
                        )}
                      >
                        <Swatch color={option.color} size="lg" />
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {option.id === activeId && (
                          <Check className="h-4 w-4 shrink-0 text-primary-emphasis" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <ul className="flex flex-wrap items-center gap-2">
          {options.map((option) => {
            const isActive = option.id === activeId;
            return (
              <li key={option.id}>
                <Button
                  variant={isActive ? "default" : "outline"}
                  aria-pressed={isActive}
                  onClick={() => onSelect(option)}
                  className="max-w-[16rem] rounded-[var(--radius-pill)] px-3"
                >
                  <Swatch color={option.color} />
                  <span className="min-w-0 truncate">{option.label}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Swatch({ color, size = "sm" }: { color: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-[var(--radius-sm)] border border-border/50",
        size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5",
      )}
      style={{ background: color }}
    />
  );
}
