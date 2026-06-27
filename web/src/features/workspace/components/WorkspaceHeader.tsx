import { ChevronDown, FileText, Menu, X } from "lucide-react";

import {
  EPHEMERAL_ARTIFACT_TAB_LABEL,
  appTabValue,
  ephemeralTabValue,
  isAppWorkspaceTab,
  isEphemeralWorkspaceTab,
  selectSidebarCollapsed,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getWorkspaceApp,
  type WorkspaceApp,
} from "@/features/workspace/apps/appRegistry";
import { WorkspaceOptionsMenu } from "@/features/workspace/components/WorkspaceOptionsMenu";
import { WORKSPACE_HOME_TAB } from "@/features/workspace/components/workspaceTabs";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const workspaceTabTriggerClass = cn(
  "gap-1.5 rounded-none rounded-t-[var(--radius-sm)] border border-transparent px-3 py-1.5",
  "-mb-px border-b-0",
  "data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
  "hover:text-foreground",
);

function TabCloseAffordance({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
          event.preventDefault();
          onClose();
        }
      }}
    >
      <X className="h-3 w-3" />
    </span>
  );
}

function getActiveLabel(
  activeWorkspaceTab: string,
  hasEphemeralTab: boolean,
): string {
  if (isAppWorkspaceTab(activeWorkspaceTab)) {
    const app = getWorkspaceApp(activeWorkspaceTab.slice("app:".length));
    if (app) return app.label;
  }
  if (isEphemeralWorkspaceTab(activeWorkspaceTab) && hasEphemeralTab) {
    return EPHEMERAL_ARTIFACT_TAB_LABEL;
  }
  return WORKSPACE_HOME_TAB.label;
}

export function WorkspaceHeader() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const openAppIds = useWorkspaceStore((s) => s.openAppIds);
  const closeAppTab = useWorkspaceStore((s) => s.closeAppTab);
  const setActiveWorkspaceTab = useWorkspaceStore((s) => s.setActiveWorkspaceTab);
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const mobileDrawerOpen = useWorkspaceStore((s) => s.mobileDrawerOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const sidebarCollapsed = selectSidebarCollapsed(isMobile, {
    sidebarWidth,
    mobileDrawerOpen,
  });

  const activeLabel = getActiveLabel(activeWorkspaceTab, Boolean(ephemeralTab));

  // Open apps in tab order, resolved against the registry.
  const openApps = openAppIds
    .map((id) => getWorkspaceApp(id))
    .filter((app): app is WorkspaceApp => Boolean(app));

  const HomeIcon = WORKSPACE_HOME_TAB.icon;

  const onTabChange = (value: string) => {
    setActiveWorkspaceTab(value as Parameters<typeof setActiveWorkspaceTab>[0]);
  };

  return (
    <header className="relative z-10 flex h-12 shrink-0 items-stretch justify-between gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-sm">
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 self-center"
          onClick={() => toggleSidebar(true)}
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Open menu" : "Close menu"}
        >
          {sidebarCollapsed ? (
            <Menu className="h-5 w-5" />
          ) : (
            <X className="h-5 w-5" />
          )}
        </Button>
      )}

      <div className="flex min-w-0 flex-1 items-stretch gap-2">
        <Tabs
          value={activeWorkspaceTab}
          onValueChange={onTabChange}
          className={cn("flex min-w-0 flex-1 self-stretch", isMobile && "hidden")}
        >
          <TabsList
            className="h-full w-full items-end justify-start gap-0"
            role="tablist"
          >
            <TabsTrigger
              value={WORKSPACE_HOME_TAB.id}
              role="tab"
              className={workspaceTabTriggerClass}
            >
              <HomeIcon className="h-4 w-4" />
              {WORKSPACE_HOME_TAB.label}
            </TabsTrigger>

            {openApps.map((app) => {
              const Icon = app.icon;
              return (
                <TabsTrigger
                  key={app.id}
                  value={appTabValue(app.id)}
                  role="tab"
                  className={cn(workspaceTabTriggerClass, "pr-2")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {app.label}
                  <TabCloseAffordance
                    label={`Close ${app.label} tab`}
                    onClose={() => closeAppTab(app.id)}
                  />
                </TabsTrigger>
              );
            })}

            {ephemeralTab && (
              <TabsTrigger
                value={ephemeralTabValue(ephemeralTab.id)}
                role="tab"
                className={cn(workspaceTabTriggerClass, "italic")}
              >
                <FileText className="h-4 w-4 shrink-0" />
                {ephemeralTab.tabLabel}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[140px] flex-1 justify-between self-center"
                aria-haspopup="listbox"
              >
                <span className="truncate">{activeLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className={cn(
                  activeWorkspaceTab === WORKSPACE_HOME_TAB.id &&
                    "bg-primary/5 text-primary",
                )}
                onSelect={() => setActiveWorkspaceTab(WORKSPACE_HOME_TAB.id)}
              >
                <HomeIcon className="h-4 w-4" />
                {WORKSPACE_HOME_TAB.label}
              </DropdownMenuItem>

              {openApps.length > 0 && <DropdownMenuSeparator />}
              {openApps.map((app) => {
                const Icon = app.icon;
                return (
                  <DropdownMenuItem
                    key={app.id}
                    className={cn(
                      activeWorkspaceTab === appTabValue(app.id) &&
                        "bg-primary/5 text-primary",
                    )}
                    onSelect={() => setActiveWorkspaceTab(appTabValue(app.id))}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{app.label}</span>
                    <span
                      role="button"
                      aria-label={`Close ${app.label} tab`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted hover:text-foreground"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        closeAppTab(app.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </DropdownMenuItem>
                );
              })}

              {ephemeralTab && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className={cn(
                      activeWorkspaceTab === ephemeralTabValue(ephemeralTab.id) &&
                        "bg-primary/5 text-primary",
                    )}
                    onSelect={() =>
                      setActiveWorkspaceTab(ephemeralTabValue(ephemeralTab.id))
                    }
                  >
                    <FileText className="h-4 w-4" />
                    <span className="italic">{ephemeralTab.tabLabel}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <WorkspaceOptionsMenu className="h-9 w-9 shrink-0 self-center" />
      </div>
    </header>
  );
}
