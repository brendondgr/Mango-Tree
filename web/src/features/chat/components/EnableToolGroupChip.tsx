import { Wrench } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";

/**
 * Inline affordance rendered under a tool result denied with
 * `details.action === "enable_tool_group"`: flips the session switch for that
 * group so the user can re-send. See docs/tool-groups.md (S9).
 */
export function EnableToolGroupChip({ group }: { group: string }) {
  const catalogue = useWorkspaceStore((s) => s.toolGroupCatalogue);
  const enabled = useWorkspaceStore((s) => s.enabledToolGroups);
  const setToolGroupEnabled = useWorkspaceStore((s) => s.setToolGroupEnabled);

  const label = catalogue.find((g) => g.id === group)?.label ?? group;
  const isEnabled = enabled.includes(group);

  if (isEnabled) {
    return (
      <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        {label} tools are on — resend your message to use them.
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{label} tools are off.</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 gap-1 px-2 text-[11px]"
        onClick={() => setToolGroupEnabled(group, true)}
      >
        <Wrench className="h-3 w-3" />
        Enable {label}
      </Button>
    </div>
  );
}
