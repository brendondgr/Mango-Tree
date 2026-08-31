import { MessageSquare, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import {
  appTabValue,
  isAppWorkspaceTab,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getWorkspaceApp,
  type WorkspaceApp,
} from "@/features/workspace/apps/appRegistry";
import { useEnabledApps } from "@/features/workspace/apps/useEnabledApps";
import { WORKSPACE_HOME_TAB } from "@/features/workspace/components/workspaceTabs";
import { useShellLayout } from "@/hooks/useShellLayout";
import { cn } from "@/lib/utils";

/**
 * Primary navigation for the compact shell.
 *
 * Replaces a 44px strip of nine 26px icons stacked above a second bar — 92px
 * of chrome, two navigation concepts, and targets well under the platform
 * minimum. Four destinations, full labels, thumb-reachable, and padded clear
 * of the home indicator. App switching moves into a sheet, which gives the
 * eight apps room for real labels.
 */
export function BottomNav() {
  const { compactView, setCompactView, chatHidden } = useShellLayout();
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const setActiveWorkspaceTab = useWorkspaceStore((s) => s.setActiveWorkspaceTab);
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const enabledApps = useEnabledApps();
  const [appsOpen, setAppsOpen] = useState(false);

  const currentApp: WorkspaceApp | undefined = isAppWorkspaceTab(activeWorkspaceTab)
    ? getWorkspaceApp(activeWorkspaceTab.slice("app:".length))
    : undefined;

  const onWorkspace = compactView === "workspace";
  const homeActive = onWorkspace && activeWorkspaceTab === WORKSPACE_HOME_TAB.id;
  const currentActive = onWorkspace && Boolean(currentApp);

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          "z-[var(--z-rail)] flex shrink-0 items-stretch border-t border-border bg-card",
          "pb-[env(safe-area-inset-bottom,0px)]",
        )}
      >
        <NavButton
          icon={MessageSquare}
          label="Chat"
          active={!chatHidden}
          onClick={() => setCompactView("chat")}
        />
        <NavButton
          icon={WORKSPACE_HOME_TAB.icon}
          label="Apps"
          active={homeActive}
          onClick={() => {
            setActiveWorkspaceTab(WORKSPACE_HOME_TAB.id);
            setCompactView("workspace");
          }}
        />
        {currentApp && (
          <NavButton
            icon={currentApp.icon}
            label={currentApp.label}
            active={currentActive}
            onClick={() => setCompactView("workspace")}
          />
        )}
        <NavButton
          icon={MoreHorizontal}
          label="More"
          active={appsOpen}
          onClick={() => setAppsOpen(true)}
        />
      </nav>

      <Sheet open={appsOpen} onOpenChange={setAppsOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Open an app</SheetTitle>
          </SheetHeader>
          <SheetBody>
            {enabledApps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No apps are enabled yet. Turn some on under Settings → Apps.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 pb-2">
                {enabledApps.map((app, index) => {
                  const Icon = app.icon;
                  const active = activeWorkspaceTab === appTabValue(app.id);
                  return (
                    <li key={app.id} data-enter style={{ "--i": index } as never}>
                      <button
                        type="button"
                        onClick={() => {
                          openAppTab(app.id);
                          setCompactView("workspace");
                          setAppsOpen(false);
                        }}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-2.5 rounded-[var(--radius-md)]",
                          "border border-border px-3 py-2.5 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary/50 bg-primary/10 text-primary-emphasis"
                            : "bg-surface-1 text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate text-sm font-medium">
                          {app.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-h-14 keeps the target above the platform floor even when the
        // safe-area padding below it is zero.
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1",
        "text-[0.6875rem] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active
          ? "text-primary-emphasis"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
