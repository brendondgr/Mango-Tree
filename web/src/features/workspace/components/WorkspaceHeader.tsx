import { ChevronDown, FileText, Menu, X } from "lucide-react";

import {
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

function getActiveLabel(
  activeWorkspaceTab: string,
  activeTab: WorkspaceTabId,
  ephemeralLabel: string | undefined,
): string {
  if (isEphemeralWorkspaceTab(activeWorkspaceTab) && ephemeralLabel) {
    return ephemeralLabel;
  }
  return WORKSPACE_TABS.find((t) => t.id === activeTab)?.label ?? "Overview";
}

export function WorkspaceHeader() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
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
    ephemeralTab?.label,
  );

  const onTabChange = (value: string) => {
    if (isEphemeralWorkspaceTab(value)) {
      setActiveWorkspaceTab(value);
      return;
    }
    setActiveWorkspaceTab(value as WorkspaceTabId);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 max-[820px]:px-4">
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
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

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Tabs
          value={activeWorkspaceTab}
          onValueChange={onTabChange}
          className={cn("min-w-0 flex-1", isMobile && "hidden")}
        >
          <TabsList className="h-auto w-full justify-start" role="tablist">
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} role="tab">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
            {ephemeralTab && (
              <TabsTrigger
                value={ephemeralTabValue(ephemeralTab.id)}
                role="tab"
                className="max-w-[12rem] italic"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{ephemeralTab.label}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[140px] flex-1 justify-between"
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
                    <span className="truncate italic">{ephemeralTab.label}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <WorkspaceOptionsMenu className="shrink-0" />
      </div>
    </header>
  );
}
