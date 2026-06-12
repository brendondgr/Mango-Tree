import { ChevronDown, Menu, X } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WORKSPACE_TABS,
  type WorkspaceTabId,
} from "@/features/workspace/components/workspaceTabs";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export function WorkspaceHeader() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const activeMeta = WORKSPACE_TABS.find((t) => t.id === activeTab)!;

  const onTabChange = (value: string) => {
    setActiveTab(value as WorkspaceTabId);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 max-[820px]:px-4">
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={toggleSidebar}
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

      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className={cn("flex-1", isMobile && "hidden")}
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
        </TabsList>
      </Tabs>

      {isMobile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="ml-auto min-w-[140px] justify-between"
              aria-haspopup="listbox"
            >
              <span>{activeMeta.label}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <DropdownMenuItem
                  key={tab.id}
                  className={cn(
                    activeTab === tab.id && "bg-primary/5 text-primary",
                  )}
                  onSelect={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
