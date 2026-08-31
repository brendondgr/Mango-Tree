import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Palette,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppsSettingsPanel } from "@/features/workspace/components/AppsSettingsPanel";
import { ColorPalettePanel } from "@/features/workspace/components/ColorPalettePanel";
import { LlmConfigPanel } from "@/features/workspace/components/LlmConfigPanel";
import { SecuritySettingsPanel } from "@/features/workspace/components/SecuritySettingsPanel";
import { useShellLayout } from "@/hooks/useShellLayout";
import { cn } from "@/lib/utils";

export type SettingsSectionId = "llm" | "apps" | "colors" | "security";

interface SettingsSectionDef {
  id: SettingsSectionId;
  label: string;
  /** One-line summary, shown under the label in both shells. */
  description: string;
  icon: LucideIcon;
}

const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
  {
    id: "llm",
    label: "LLM",
    description: "Provider, model, and connection",
    icon: Settings2,
  },
  {
    id: "apps",
    label: "Apps",
    description: "Which apps this workspace offers",
    icon: LayoutGrid,
  },
  {
    id: "colors",
    label: "Color palette",
    description: "Theme, presets, and custom colors",
    icon: Palette,
  },
  {
    id: "security",
    label: "Security",
    description: "Account, lockouts, and sign-in log",
    icon: ShieldCheck,
  },
];

const DEFAULT_SECTION: SettingsSectionId = "llm";

const SETTINGS_SUMMARY =
  "LLM connection, apps, appearance, and security for this workspace.";

/**
 * One block of settings: a heading, optional supporting line, optional
 * right-aligned action.
 *
 * It lives here rather than in its own module so every panel in this dialog
 * shares one vertical rhythm — the panels used to each invent their own
 * heading markup, which is why the same `h3` appeared at three different sizes
 * depending on which tab you were on.
 */
export interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  /** Control aligned with the title, e.g. Refresh or Reset. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * `active` is threaded through unchanged: both panels that take it use it to
 * fetch only once the section is on screen.
 */
function renderPanel(id: SettingsSectionId, active: boolean): ReactNode {
  switch (id) {
    case "llm":
      return <LlmConfigPanel active={active} />;
    case "apps":
      return <AppsSettingsPanel />;
    case "colors":
      return <ColorPalettePanel />;
    case "security":
      return <SecuritySettingsPanel active={active} />;
  }
}

function sectionDef(id: SettingsSectionId): SettingsSectionDef {
  return SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0];
}

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Section to land on when opened. Callers that name a destination — "Manage
   * apps", say — must arrive there; without this they landed on the LLM panel
   * and the user had to find Apps themselves. Omit to use the default entry
   * point (the section list on compact, the LLM panel on desktop).
   */
  initialSection?: SettingsSectionId;
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  initialSection,
}: WorkspaceSettingsDialogProps) {
  const { isCompact } = useShellLayout();
  // null means "no section chosen": the compact shell shows its section list,
  // the wide shell falls back to the default tab.
  const [section, setSection] = useState<SettingsSectionId | null>(null);

  useEffect(() => {
    if (open) setSection(initialSection ?? null);
  }, [initialSection, open]);

  if (isCompact) {
    return (
      <CompactSettingsSheet
        open={open}
        onOpenChange={onOpenChange}
        section={section}
        onSelect={setSection}
      />
    );
  }

  return (
    <WideSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      section={section ?? DEFAULT_SECTION}
      onSelect={setSection}
    />
  );
}

/**
 * Compact shell: a full-bleed sheet with the two-level pattern every mobile
 * settings screen uses — a list of sections, then one section at a time behind
 * a Back control.
 *
 * The tab rail this replaces truncated all four labels to a single character
 * plus an ellipsis at 360px, and its icons were `aria-hidden`, so the primary
 * navigation of settings had no readable name at all on a phone.
 */
function CompactSettingsSheet({
  open,
  onOpenChange,
  section,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSectionId | null;
  onSelect: (section: SettingsSectionId | null) => void;
}) {
  const detailRef = useRef<HTMLDivElement>(null);
  const current = section ? sectionDef(section) : null;

  // Focus follows the pushed view, so the next Tab lands inside the panel
  // rather than back at the top of the list the user just left.
  useEffect(() => {
    if (section) detailRef.current?.focus();
  }, [section]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showHandle={false}
        className={cn(
          "top-0 max-h-none rounded-none border-t-0",
          "pt-[env(safe-area-inset-top,0px)]",
        )}
      >
        {current ? (
          <SheetHeader className="flex-row items-center gap-1 border-b border-border pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 shrink-0"
              onClick={() => onSelect(null)}
              aria-label="Back to all settings"
            >
              <ChevronLeft />
            </Button>
            <div className="min-w-0">
              <SheetTitle className="truncate">{current.label}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {current.description}
              </SheetDescription>
            </div>
          </SheetHeader>
        ) : (
          <SheetHeader className="border-b border-border">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription className="text-xs">
              {SETTINGS_SUMMARY}
            </SheetDescription>
          </SheetHeader>
        )}

        <SheetBody className="pt-3">
          {current ? (
            <div ref={detailRef} tabIndex={-1} className="outline-none">
              {renderPanel(current.id, open)}
            </div>
          ) : (
            <ul className="grid gap-2">
              {SETTINGS_SECTIONS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    data-enter
                    style={{ "--i": index } as never}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-lg)]",
                        "border border-border bg-card px-3 py-3 text-left transition-colors",
                        "hover:border-primary/60 hover:bg-muted/40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-2 text-muted-foreground"
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

const railTriggerClass = cn(
  "flex w-full items-start justify-start gap-2.5 whitespace-normal text-left",
  "rounded-[var(--radius-md)] border-b-0 border-l-2 px-3 py-2.5",
  "hover:bg-muted/50 data-[state=active]:border-l-primary",
);

/**
 * Wide shell: the rail keeps its sidebar-plus-detail split, but is wide enough
 * for the full label plus its summary line. Radix supplies the roving tabindex
 * and arrow-key movement for the vertical tablist.
 */
function WideSettingsDialog({
  open,
  onOpenChange,
  section,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 pr-12">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>{SETTINGS_SUMMARY}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={section}
          onValueChange={(value) => onSelect(value as SettingsSectionId)}
          orientation="vertical"
          className="flex min-h-0 flex-1 flex-row"
        >
          <TabsList
            className="w-60 shrink-0 flex-col items-stretch gap-1 overflow-y-auto border-r border-border p-3"
            aria-label="Settings sections"
          >
            {SETTINGS_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className={railTriggerClass}
                >
                  <Icon className="mt-0.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent
            value={section}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            forceMount
          >
            <DialogBody className="mx-0 px-6 py-5">
              {renderPanel(section, open)}
            </DialogBody>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
