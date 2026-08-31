import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@recipes/components/Textarea";

/** One instruction, numbered, with a labelled remove control. */
export interface StepRowProps {
  value: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}

export function StepRow({ value, index, onChange, onRemove }: StepRowProps) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-primary text-xs font-semibold text-primary-foreground"
      >
        {index + 1}
      </span>
      <Textarea
        id={`step-${index}`}
        aria-label={`Step ${index + 1}`}
        rows={2}
        className="min-w-0 flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">Remove step {index + 1}</span>
      </Button>
    </li>
  );
}
