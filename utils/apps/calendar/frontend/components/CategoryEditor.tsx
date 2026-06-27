import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { PaletteColor } from "@/types/calendar";

import type { EventColor } from "../utils/colors";

/**
 * A category chip that opens an inline popover for editing — recolor via the
 * palette swatches, or rename the category (which rewrites every event of that
 * type on the server). Dependency-free: the panel is an absolutely-positioned
 * div closed on outside-click or Escape.
 */
export function CategoryEditor({
  type,
  swatch,
  currentColorName,
  palette,
  onPickColor,
  onRename,
  busy,
}: {
  type: string;
  swatch: EventColor;
  currentColorName: string;
  palette: PaletteColor[];
  onPickColor: (colorName: string) => void;
  onRename: (newName: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(type);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(type);
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, type]);

  function submitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== type) onRename(trimmed);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="calendar-cat">
      <button
        type="button"
        className="calendar-cat-btn"
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="calendar-legend-swatch"
          style={{ background: swatch.bg, borderColor: swatch.border }}
        />
        <span className="capitalize">{type}</span>
      </button>

      {open ? (
        <div className="calendar-cat-pop" role="dialog">
          <label className="calendar-cat-label" htmlFor={`cat-rename-${type}`}>
            Name
          </label>
          <div className="flex gap-1.5">
            <input
              id={`cat-rename-${type}`}
              className="calendar-cat-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
              }}
            />
            <button
              type="button"
              className="calendar-cat-save"
              onClick={submitRename}
              disabled={busy || !name.trim() || name.trim() === type}
            >
              Save
            </button>
          </div>

          <div className="calendar-cat-label mt-2">Color</div>
          <div className="calendar-swatches">
            {palette.map((c) => {
              const active = c.name === currentColorName;
              return (
                <button
                  key={c.name}
                  type="button"
                  className="calendar-swatch"
                  data-active={active || undefined}
                  title={c.name}
                  style={{ background: c.bgHex, borderColor: c.borderHex }}
                  onClick={() => onPickColor(c.name)}
                >
                  {active ? <Check className="h-3 w-3" style={{ color: c.textHex }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
