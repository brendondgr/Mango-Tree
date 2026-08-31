import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";

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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PaletteColor } from "@/types/calendar";

import {
  categoryForKey,
  categoryForName,
  categoryStyle,
  type CategoryColor,
} from "../utils/colors";

/**
 * A category chip that opens its recolor / rename editor.
 *
 * This used to be a hand-rolled absolutely positioned popover pinned to
 * `left: 0` of the chip. A chip sitting near the right edge of a narrow pane
 * pushed a 16rem panel straight off screen — an overflow with no scroll and no
 * way back — and its 22px swatches were under the minimum touch target. It now
 * uses the shared overlay primitives, which portal out of the pane: a bottom
 * sheet where the pane is narrow, a dialog where it is not.
 */
export function CategoryEditor({
  type,
  color,
  currentColorName,
  palette,
  onPickColor,
  onRename,
  busy,
  compact = false,
}: {
  type: string;
  color: CategoryColor;
  currentColorName: string;
  palette: PaletteColor[];
  onPickColor: (colorName: string) => void;
  onRename: (newName: string) => void;
  busy?: boolean;
  /** Render the editor as a bottom sheet rather than a dialog. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(type);

  useEffect(() => {
    if (open) setName(type);
  }, [open, type]);

  const trimmed = name.trim();
  const canRename = !busy && trimmed.length > 0 && trimmed !== type;

  function submitRename() {
    if (!canRename) return;
    onRename(trimmed);
    setOpen(false);
  }

  const trigger = (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring app:min-h-9"
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <span
        aria-hidden
        className="calendar-tint h-3.5 w-3.5 shrink-0 rounded-[0.25rem] border"
        style={categoryStyle(color)}
      />
      <span className="capitalize">{type}</span>
      <span className="sr-only">— edit category</span>
    </button>
  );

  const title = `Edit "${type}"`;
  const description = `Rename this category everywhere it is used, or change the color it paints on the grid. Currently ${color.label}.`;

  const body = (
    <div className="space-y-4">
      <Field label="Name" hint="Renaming rewrites every event of this type.">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            }
          }}
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Color
        </p>
        <ul className="grid grid-cols-5 gap-2">
          {palette.map((entry) => {
            const swatch = categoryForName(entry.name) ?? categoryForKey(entry.name);
            const active = entry.name === currentColorName;
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  className="calendar-tint flex aspect-square w-full items-center justify-center rounded-[var(--radius-sm)] border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[active=true]:ring-2 data-[active=true]:ring-ring data-[active=true]:ring-offset-2"
                  style={categoryStyle(swatch)}
                  data-active={active || undefined}
                  aria-pressed={active}
                  onClick={() => onPickColor(entry.name)}
                >
                  <span className="sr-only">{swatch.label}</span>
                  {active ? (
                    <Check className="h-4 w-4 text-foreground" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Close
      </Button>
      <Button type="button" onClick={submitRename} disabled={!canRename}>
        Save name
      </Button>
    </>
  );

  if (compact) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" aria-hidden />
                {title}
              </SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <SheetBody>{body}</SheetBody>
            <SheetFooter>{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody>{body}</DialogBody>
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
