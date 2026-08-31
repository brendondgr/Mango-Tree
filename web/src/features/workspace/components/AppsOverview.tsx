import {
  ArrowUpRight,
  Layers,
  LayoutGrid,
  MessageSquarePlus,
  Palette,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useEnabledApps } from "@/features/workspace/apps/useEnabledApps";
import { WorkspaceSettingsDialog } from "@/features/workspace/components/WorkspaceSettingsDialog";
import { useShellLayout } from "@/hooks/useShellLayout";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/**
 * Horizontal rhythm shared by all three bands.
 *
 * Sized in `cqi` against the root's inline-size container, so the gutters grow
 * when the pane is widened by dragging the chat sidebar closed — a viewport
 * breakpoint cannot see that change at all.
 */
const BAND_X = "px-[clamp(0.875rem,3cqi,2.5rem)]";

/**
 * Default landing surface shown whenever no app tab is active.
 *
 * Three bands: a status strip that gives the panel a top edge, the launcher
 * grid, and a footer of quick actions so the bottom terminates instead of
 * trailing off into dead space. The grid is intrinsically sized
 * (`auto-fill` + `minmax`) rather than capped to a centred column, so it fills
 * a 320px phone and a 2560px monitor with the same rule.
 */
export function AppsOverview() {
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const openAppIds = useWorkspaceStore((s) => s.openAppIds);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const startNewChat = useWorkspaceStore((s) => s.startNewChat);
  const { showChat } = useShellLayout();
  const { theme, themeMeta } = useTheme();
  const enabledApps = useEnabledApps();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openTabCount = openAppIds.length + (ephemeralTab ? 1 : 0);

  return (
    <section
      aria-labelledby="apps-overview-heading"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background"
      // No Tailwind utility maps to `container-type`, and the whole layout
      // below is measured against the pane rather than the viewport.
      style={{ containerType: "inline-size" }}
    >
      <div
        className={cn(
          "sticky top-0 z-[var(--z-header)] flex shrink-0 items-center gap-2.5",
          "overflow-hidden border-b border-border bg-surface-1/95 py-2",
          "text-xs text-muted-foreground backdrop-blur-sm",
          BAND_X,
        )}
      >
        <Stat icon={LayoutGrid}>
          {enabledApps.length} {enabledApps.length === 1 ? "app" : "apps"} enabled
        </Stat>
        <StatDivider className="hidden @[26rem]:block" />
        <Stat icon={Palette} className="hidden @[26rem]:flex">
          <span className="sr-only">Theme </span>
          {themeMeta?.label ?? theme}
        </Stat>
        <StatDivider className="hidden @[38rem]:block" />
        <Stat icon={Layers} className="hidden @[38rem]:flex">
          {openTabCount} {openTabCount === 1 ? "tab" : "tabs"} open
        </Stat>
      </div>

      <div className={cn("flex-1 py-5", BAND_X)}>
        <h2
          id="apps-overview-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Your apps
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open one in a workspace tab, or ask the agent to work in it for you.
        </p>

        {enabledApps.length === 0 ? (
          <EmptyState
            className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-border"
            icon={LayoutGrid}
            title="No apps are enabled yet"
            description="Turn apps on under Settings → Apps and they will appear here, in the tab strip, and on the nav rail."
            action={
              <Button onClick={() => setSettingsOpen(true)}>
                <Settings2 aria-hidden />
                Manage apps
              </Button>
            }
          />
        ) : (
          <ul
            className="mt-4 grid gap-3"
            // The `min(100%, 15rem)` floor matters: a bare 15rem minimum
            // overflows any pane narrower than 15rem.
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
            }}
          >
            {enabledApps.map((app, index) => {
              const Icon = app.icon;
              return (
                <li key={app.id} data-enter style={{ "--i": index } as never}>
                  <button
                    type="button"
                    onClick={() => openAppTab(app.id)}
                    className={cn(
                      "group flex h-full w-full flex-col items-start gap-3 text-left",
                      "rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-xs",
                      "transition-all duration-[var(--motion-duration-sm)] ease-[var(--motion-ease-standard)]",
                      "hover:border-primary/50 hover:bg-surface-1 hover:shadow-md",
                      // Travel is zero unless the user allows motion, so this
                      // is already correct under prefers-reduced-motion.
                      "hover:translate-y-[calc(var(--motion-travel-sm)*-1)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "active:translate-y-0 active:shadow-xs",
                    )}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center",
                          "rounded-[var(--radius-md)] border border-border bg-surface-2 text-muted-foreground",
                          "transition-colors duration-[var(--motion-duration-xs)]",
                          "group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary-emphasis",
                        )}
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowUpRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground opacity-0",
                          "transition-opacity duration-[var(--motion-duration-xs)]",
                          "group-hover:opacity-100 group-focus-visible:opacity-100",
                        )}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground transition-colors group-hover:text-primary-emphasis">
                        {app.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {app.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer
        className={cn(
          "sticky bottom-0 mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3",
          "border-t border-border bg-surface-1/95 py-3 backdrop-blur-sm",
          BAND_X,
        )}
      >
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            onClick={() => {
              startNewChat();
              showChat();
            }}
          >
            <MessageSquarePlus aria-hidden />
            New chat
          </Button>
          {enabledApps.length > 0 && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 aria-hidden />
              Manage apps
            </Button>
          )}
        </div>
      </footer>

      <WorkspaceSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection="apps"
      />
    </section>
  );
}

function Stat({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

function StatDivider({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-3 w-px shrink-0 bg-border", className)}
      aria-hidden
    />
  );
}
