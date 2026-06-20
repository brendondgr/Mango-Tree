import { ChevronDown, Dumbbell, FileText, Menu, X } from "lucide-react";

import {
  EPHEMERAL_ARTIFACT_TAB_LABEL,
  EXERCISE_TAB_LABEL,
  EXERCISE_WORKSPACE_TAB,
  ephemeralTabValue,
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
import { WorkspaceOptionsMenu } from "@/features/workspace/components/WorkspaceOptionsMenu";
import {
  WORKSPACE_TABS,
  type WorkspaceTabId,
} from "@/features/workspace/components/workspaceTabs";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const workspaceTabTriggerClass = cn(
  "gap-1.5 rounded-none rounded-t-[var(--radius-sm)] border border-transparent px-3 py-1.5",
  "-mb-px border-b-0",
  "data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
  "hover:text-foreground",
);

function getActiveLabel(
  activeWorkspaceTab: string,
  activeTab: WorkspaceTabId,
  hasEphemeralTab: boolean,
): string {
  if (activeWorkspaceTab === EXERCISE_WORKSPACE_TAB) {
    return EXERCISE_TAB_LABEL;
  }
  if (isEphemeralWorkspaceTab(activeWorkspaceTab) && hasEphemeralTab) {
    return EPHEMERAL_ARTIFACT_TAB_LABEL;
  }
  return WORKSPACE_TABS.find((t) => t.id === activeTab)?.label ?? "Overview";
}

export function WorkspaceHeader() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const exerciseTabOpen = useWorkspaceStore((s) => s.exerciseTabOpen);
  const closeExerciseTab = useWorkspaceStore((s) => s.closeExerciseTab);
  const setActiveWorkspaceTab = useWorkspaceStore((s) => s.setActiveWorkspaceTab);
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const mobileDrawerOpen = useWorkspaceStore((s) => s.mobileDrawerOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const sidebarCollapsed = selectSidebarCollapsed(isMobile, {
    sidebarWidth,
    mobileDrawerOpen,
  });

  const activeLabel = getActiveLabel(
    activeWorkspaceTab,
    activeTab,
    Boolean(ephemeralTab),
  );

  const onTabChange = (value: string) => {
    if (isEphemeralWorkspaceTab(value) || value === EXERCISE_WORKSPACE_TAB) {
      setActiveWorkspaceTab(value as WorkspaceTabId);
      return;
    }
    setActiveWorkspaceTab(value as WorkspaceTabId);
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
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  role="tab"
                  className={workspaceTabTriggerClass}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
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
            {exerciseTabOpen && (
              <TabsTrigger
                value={EXERCISE_WORKSPACE_TAB}
                role="tab"
                className={cn(workspaceTabTriggerClass, "pr-2")}
              >
                <Dumbbell className="h-4 w-4 shrink-0" />
                {EXERCISE_TAB_LABEL}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Close Exercise tab"
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    closeExerciseTab();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      event.preventDefault();
                      closeExerciseTab();
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
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
              {WORKSPACE_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <DropdownMenuItem
                    key={tab.id}
                    className={cn(
                      activeWorkspaceTab === tab.id && "bg-primary/5 text-primary",
                    )}
                    onSelect={() => setActiveWorkspaceTab(tab.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
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
              {exerciseTabOpen && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className={cn(
                      activeWorkspaceTab === EXERCISE_WORKSPACE_TAB &&
                        "bg-primary/5 text-primary",
                    )}
                    onSelect={() => setActiveWorkspaceTab(EXERCISE_WORKSPACE_TAB)}
                  >
                    <Dumbbell className="h-4 w-4" />
                    <span className="flex-1">{EXERCISE_TAB_LABEL}</span>
                    <span
                      role="button"
                      aria-label="Close Exercise tab"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted hover:text-foreground"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        closeExerciseTab();
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
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
