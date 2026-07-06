import { SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchToolGroups } from "@/services/toolsClient";
import { cn } from "@/lib/utils";

/**
 * Fetch the tool-group catalogue once per app load into the store. Kept as a
 * hook so the composer can drive it even before the popover is opened.
 */
export function useToolGroupCatalogue() {
  const catalogueLength = useWorkspaceStore((s) => s.toolGroupCatalogue.length);
  const setCatalogue = useWorkspaceStore((s) => s.setToolGroupCatalogue);

  useEffect(() => {
    if (catalogueLength > 0) return;
    let active = true;
    fetchToolGroups()
      .then((groups) => {
        if (active) setCatalogue(groups);
      })
      .catch(() => {
        /* leave the catalogue empty; the popover shows a loading hint */
      });
    return () => {
      active = false;
    };
  }, [catalogueLength, setCatalogue]);
}

function capabilitySatisfied(requires: string | undefined, boundWorkspaceId: string | null) {
  if (!requires) return true;
  if (requires === "workspace") return Boolean(boundWorkspaceId);
  return false; // unknown precondition — conservatively locked
}

export function ToolGroupsPopover({ disabled }: { disabled?: boolean }) {
  useToolGroupCatalogue();

  const catalogue = useWorkspaceStore((s) => s.toolGroupCatalogue);
  const enabled = useWorkspaceStore((s) => s.enabledToolGroups);
  const setToolGroupEnabled = useWorkspaceStore((s) => s.setToolGroupEnabled);
  const defaults = useWorkspaceStore((s) => s.defaultEnabledToolGroups);
  const setDefaults = useWorkspaceStore((s) => s.setDefaultEnabledToolGroups);
  const boundWorkspaceId = useWorkspaceStore((s) => s.boundWorkspaceId);

  const toolCount = catalogue
    .filter((group) => enabled.includes(group.id))
    .reduce((sum, group) => sum + group.tools.length, 0);
  const badgeCount = catalogue.length > 0 ? toolCount : enabled.length;

  const isDefault =
    defaults.length === enabled.length &&
    defaults.every((id) => enabled.includes(id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Tool groups"
          title="Tool groups"
          disabled={disabled}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {badgeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80">
        <div className="mb-3">
          <p className="text-sm font-medium">Tools</p>
          <p className="text-xs text-muted-foreground">
            Choose which tool groups the agent can use in this chat.
          </p>
        </div>

        <div className="grid max-h-[320px] gap-1 overflow-y-auto">
          {catalogue.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">Loading tools…</p>
          )}
          {catalogue.map((group) => {
            const locked = !capabilitySatisfied(group.requires, boundWorkspaceId);
            const isOn = enabled.includes(group.id);
            const row = (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-1 py-1.5",
                  locked && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{group.label}</span>
                    <Badge variant="muted">{group.tools.length}</Badge>
                  </div>
                  {locked && (
                    <span className="text-[11px] text-muted-foreground">
                      Enable a {group.requires} first
                    </span>
                  )}
                </div>
                <Switch
                  checked={isOn}
                  disabled={locked}
                  onCheckedChange={(value) => setToolGroupEnabled(group.id, value)}
                  aria-label={`Toggle ${group.label} tools`}
                />
              </div>
            );
            return locked ? (
              <TooltipProvider key={group.id} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>{row}</div>
                  </TooltipTrigger>
                  <TooltipContent>Enable a {group.requires} first</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div key={group.id}>{row}</div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>
            {enabled.length} group{enabled.length === 1 ? "" : "s"}
            {catalogue.length > 0 ? ` · ${toolCount} tools` : ""}
          </span>
          <button
            type="button"
            className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            disabled={isDefault}
            onClick={() => setDefaults(enabled)}
          >
            {isDefault ? "Saved as default" : "Save as default"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
