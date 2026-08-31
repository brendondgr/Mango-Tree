import { useId } from "react";
import { RotateCcw, X } from "lucide-react";

import {
  type MailboxTextSize,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TEXT_OPTIONS: Array<{ label: string; value: MailboxTextSize }> = [
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
];

const LOAD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "50 messages", value: "50" },
  { label: "100 messages", value: "100" },
  { label: "250 messages", value: "250" },
  { label: "500 messages", value: "500" },
  { label: "All messages", value: "all" },
];

const SCROLLBAR = "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60";

/**
 * Inbox preferences.
 *
 * Two presentations, one body. On a wide pane it stays the non-modal panel it
 * always was, docked beside the list so you can watch a setting take effect on
 * the real messages; on a narrow one it becomes a bottom sheet, because a
 * 340px drawer over a 360px pane is the whole screen anyway and Radix gives the
 * focus trap and Escape handling for free.
 *
 * The critical change is that it is UNMOUNTED when closed. It used to sit
 * off-canvas under `aria-hidden` with roughly twenty controls still in the tab
 * order — reachable by Tab, invisible, and stripped of their accessible names,
 * so a screen-reader user could silently toggle inbox preferences. It was also
 * the entire source of the 80 elements this surface reported as overflowing its
 * pane at every viewport.
 */
export function CustomizePanel({
  open,
  onOpenChange,
  narrow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
}) {
  const reset = useWorkspaceStore((s) => s.resetMailboxPrefs);

  const resetButton = (
    <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={reset}>
      <RotateCcw className="h-4 w-4" />
      Reset to defaults
    </Button>
  );

  if (narrow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Customize inbox</SheetTitle>
            <SheetDescription>Saved on this device, kept between sessions.</SheetDescription>
          </SheetHeader>
          <SheetBody className={SCROLLBAR}>
            <CustomizeControls />
          </SheetBody>
          <SheetFooter>{resetButton}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside
      className="flex w-80 shrink-0 flex-col border-l border-border bg-card shadow-lg"
      aria-label="Customize inbox"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Customize inbox</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close customize panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4", SCROLLBAR)}>
        <p className="mb-4 text-xs text-muted-foreground">
          Saved on this device, kept between sessions.
        </p>
        <CustomizeControls />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">{resetButton}</div>
    </aside>
  );
}

function CustomizeControls() {
  const prefs = useWorkspaceStore((s) => s.mailboxPrefs);
  const setPrefs = useWorkspaceStore((s) => s.setMailboxPrefs);
  const density = useWorkspaceStore((s) => s.mailboxDensity);

  return (
    <div className="space-y-6">
      <Section title="Show">
        <ToggleRow
          label="Provider icon"
          checked={prefs.showProviderIcon}
          onChange={(v) => setPrefs({ showProviderIcon: v })}
        />
        <ToggleRow
          label="Description / preview"
          checked={prefs.showSnippet}
          onChange={(v) => setPrefs({ showSnippet: v })}
        />
        <ToggleRow
          label="Date"
          checked={prefs.showDate}
          onChange={(v) => setPrefs({ showDate: v })}
        />
        <ToggleRow
          label="Account badge"
          checked={prefs.showAccountBadge}
          onChange={(v) => setPrefs({ showAccountBadge: v })}
        />
        <ToggleRow
          label="Provider badge"
          checked={prefs.showProviderBadge}
          onChange={(v) => setPrefs({ showProviderBadge: v })}
        />
        <ToggleRow
          label="Unread badge"
          checked={prefs.showUnreadBadge}
          onChange={(v) => setPrefs({ showUnreadBadge: v })}
        />
      </Section>

      <Section title="Text & spacing">
        <SelectField
          label="Text size"
          value={prefs.textSize}
          options={TEXT_OPTIONS}
          onValueChange={(value) => setPrefs({ textSize: value as MailboxTextSize })}
        />
        <ToggleRow
          label="Tighter rows"
          checked={prefs.tightRows}
          onChange={(v) => setPrefs({ tightRows: v })}
        />
      </Section>

      <Section
        title="Column widths"
        hint={
          density === "compact"
            ? "Drag the dividers in the list header, or set them here."
            : "Applies in Compact density."
        }
      >
        <SliderRow
          label="From"
          min={80}
          max={360}
          value={prefs.fromWidth}
          onChange={(v) => setPrefs({ fromWidth: v })}
        />
        <SliderRow
          label="Title"
          min={120}
          max={560}
          value={prefs.subjectWidth}
          onChange={(v) => setPrefs({ subjectWidth: v })}
        />
        <SliderRow
          label="Description"
          hint="0 fills the remaining space."
          min={0}
          max={640}
          value={prefs.snippetWidth}
          onChange={(v) => setPrefs({ snippetWidth: v })}
        />
      </Section>

      <Section
        title="List width"
        hint={density === "modern" ? undefined : "Applies in Modern density."}
      >
        <SliderRow
          label="List column"
          min={320}
          max={760}
          value={prefs.listWidth}
          onChange={(v) => setPrefs({ listWidth: v })}
        />
      </Section>

      <Section title="Messages to load">
        <SelectField
          label="Messages to load per account"
          hideLabel
          value={String(prefs.loadLimit)}
          options={LOAD_OPTIONS}
          onValueChange={(value) => setPrefs({ loadLimit: value === "all" ? "all" : Number(value) })}
        />
      </Section>
    </div>
  );
}

/**
 * A labelled Radix Select.
 *
 * `Field` is the right tool for one control element, but a Radix `Select` is a
 * tree — `Field` would clone the *Root*, which silently discards the `id` and
 * the aria wiring, leaving the trigger with no association at all. Naming the
 * trigger with `aria-labelledby="<label> <trigger>"` also survives the moment
 * before Radix has populated the value node, where the button would otherwise
 * have no accessible name whatsoever.
 */
function SelectField<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onValueChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: Array<{ label: string; value: T }>;
  onValueChange: (value: T) => void;
}) {
  const labelId = useId();
  const triggerId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId} htmlFor={triggerId} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
        <SelectTrigger id={triggerId} aria-labelledby={`${labelId} ${triggerId}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    // `Label htmlFor` pointing at the switch keeps the whole 44px row clickable
    // without wrapping a button in a label, which would target Radix's hidden
    // bubble input instead.
    <div className="flex min-h-11 items-center justify-between gap-3 app:min-h-9">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="h-6 w-10" />
    </div>
  );
}

function SliderRow({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={`${label} — ${value}px`} hint={hint}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-primary app:h-6"
      />
    </Field>
  );
}
