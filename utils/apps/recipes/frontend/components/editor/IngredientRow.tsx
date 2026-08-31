import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type IngRow } from "@recipes/utils/ingredientRow";

/**
 * One editable ingredient.
 *
 * The old row was a single `flex` line holding a `width: 130px; flex-shrink: 0`
 * `<select>`, three inputs and a delete button — roughly 430px of hard minimum,
 * so on a phone it simply ran off the side of the form. This is a *wrapping*
 * flex row whose parts carry intrinsic minimums instead of fixed track widths,
 * so it reflows to two or three lines on a narrow pane and collapses back to
 * one when there is room. No breakpoint is involved at all.
 *
 * Column labels are shown once, on the first row, and are screen-reader-only
 * afterwards — every control stays labelled without repeating six labels per
 * ingredient.
 */
export interface IngredientRowProps {
  row: IngRow;
  index: number;
  onChange: (patch: Partial<IngRow>) => void;
  onRemove: () => void;
}

export function IngredientRow({ row, index, onChange, onRemove }: IngredientRowProps) {
  const showLabels = index === 0;

  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface-1 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field
          label="Ingredient"
          htmlFor={`ing-name-${index}`}
          hideLabel={!showLabels}
          className="min-w-[9rem] flex-[3_1_11rem]"
        >
          <Input
            placeholder="Ingredient"
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>

        <Field label="Qty" hideLabel={!showLabels} className="w-[4.75rem] flex-none">
          <Input
            placeholder="Qty"
            inputMode="decimal"
            value={row.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </Field>

        <Field label="Unit" hideLabel={!showLabels} className="w-[5.5rem] flex-none">
          <Input
            placeholder="Unit"
            value={row.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
          />
        </Field>

        {/* Not wrapped in Field: Field clones its child to inject the id, and
            Radix's Select root renders no DOM node to receive it. */}
        <div className="min-w-[9rem] flex-[2_1_10rem] space-y-1.5">
          <Label
            htmlFor={`ing-category-${index}`}
            className={showLabels ? undefined : "sr-only"}
          >
            Category
          </Label>
          <Select value={row.category} onValueChange={(value) => onChange({ category: value })}>
            <SelectTrigger id={`ing-category-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-none items-center gap-1">
          {/* A pressed-state button rather than a 13px native checkbox. */}
          <Button
            type="button"
            variant={row.is_optional ? "secondary" : "outline"}
            aria-pressed={row.is_optional}
            onClick={() => onChange({ is_optional: !row.is_optional })}
          >
            Optional
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Remove ingredient {index + 1}</span>
          </Button>
        </div>
      </div>
    </li>
  );
}
