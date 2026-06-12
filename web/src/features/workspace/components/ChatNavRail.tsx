import { MessageSquare, FolderOpen } from "lucide-react";

import { useWorkspaceStore, type SidebarMode } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const destinations: Array<{
  mode: SidebarMode;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { mode: "chat", label: "Chat", icon: MessageSquare },
  { mode: "artifacts", label: "Artifacts", icon: FolderOpen },
];

export function ChatNavRail() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const sidebarMode = useWorkspaceStore((s) => s.sidebarMode);
  const setSidebarMode = useWorkspaceStore((s) => s.setSidebarMode);
  const expandSidebar = useWorkspaceStore((s) => s.expandSidebar);

  const handleSelect = (mode: SidebarMode) => {
    setSidebarMode(mode);
    expandSidebar();
  };

  return (
    <nav
      aria-label="Workspace sidebar sections"
      className={cn(
        "z-30 shrink-0 border-border bg-card",
        isMobile
          ? "flex h-11 w-full items-center justify-center gap-1 border-b px-2"
          : "flex w-[52px] flex-col items-center gap-1 border-r py-3",
      )}
    >
      {destinations.map(({ mode, label, icon: Icon }) => {
        const active = sidebarMode === mode;
        return (
          <Button
            key={mode}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-[var(--radius-md)]",
              active && "bg-secondary text-foreground",
            )}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            onClick={() => handleSelect(mode)}
          >
            <Icon className="h-5 w-5" />
          </Button>
        );
      })}
    </nav>
  );
}
