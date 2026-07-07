import { Check } from "lucide-react";

import { WORKSPACE_APPS } from "@/features/workspace/apps/appRegistry";
import { cn } from "@/lib/utils";

/**
 * Grid of enable/disable cards for every workspace app. Controlled: the parent
 * owns the selected-id set. Shared by the onboarding screen and the Settings →
 * Apps panel. The chat window is core and always available, so it is not listed.
 */
export function AppToggleGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {WORKSPACE_APPS.map((app) => {
        const Icon = app.icon;
        const isOn = selected.includes(app.id);
        return (
          <li key={app.id}>
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              onClick={() => onToggle(app.id, !isOn)}
              className={cn(
                "flex h-full w-full items-start gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isOn
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-card hover:border-primary hover:ring-1 hover:ring-inset hover:ring-primary",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
                  isOn
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {app.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {app.description}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  isOn
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent",
                )}
                aria-hidden
              >
                {isOn ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
