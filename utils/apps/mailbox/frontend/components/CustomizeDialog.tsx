import { RotateCcw, SlidersHorizontal } from "lucide-react";

import {
  type MailboxTextSize,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TEXT_OPTIONS: Array<{ label: string; value: MailboxTextSize }> = [
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
];

const LOAD_OPTIONS: Array<{ label: string; value: number | "all" }> = [
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "250", value: 250 },
  { label: "500", value: 500 },
  { label: "All", value: "all" },
];

export function CustomizeDialog() {
  const prefs = useWorkspaceStore((s) => s.mailboxPrefs);
  const setPrefs = useWorkspaceStore((s) => s.setMailboxPrefs);
  const reset = useWorkspaceStore((s) => s.resetMailboxPrefs);
  const density = useWorkspaceStore((s) => s.mailboxDensity);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Customize inbox">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="mailbox-app max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize inbox</DialogTitle>
          <DialogDescription>Saved on this device and kept between sessions.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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
            <Segmented
              options={TEXT_OPTIONS}
              value={prefs.textSize}
              onChange={(v) => setPrefs({ textSize: v })}
            />
            <ToggleRow
              label="Tighter rows"
              checked={prefs.tightRows}
              onChange={(v) => setPrefs({ tightRows: v })}
            />
          </Section>

          <Section
            title={
              density === "compact"
                ? "Column widths (Compact)"
                : "Column widths (apply in Compact mode)"
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
              label="Description (0 = fill)"
              min={0}
              max={640}
              value={prefs.snippetWidth}
              onChange={(v) => setPrefs({ snippetWidth: v })}
            />
          </Section>

          <Section
            title={
              density === "modern"
                ? "List width (Modern)"
                : "List width (applies in Modern mode)"
            }
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
            <Segmented
              options={LOAD_OPTIONS}
              value={prefs.loadLimit}
              onChange={(v) => setPrefs({ loadLimit: v })}
            />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
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
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-0.5 text-sm text-foreground">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]"
      />
    </label>
  );
}

function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-foreground">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mailbox-seg w-full">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className="mailbox-seg-btn flex-1 justify-center"
          data-active={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
