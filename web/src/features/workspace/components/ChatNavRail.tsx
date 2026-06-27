import { MessageSquare } from "lucide-react";

import {
  appTabValue,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { WORKSPACE_APPS } from "@/features/workspace/apps/appRegistry";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export function ChatNavRail() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const expandSidebar = useWorkspaceStore((s) => s.expandSidebar);
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);

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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-[var(--radius-md)]"
        aria-label="Chat"
        title="Chat"
        onClick={() => expandSidebar()}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      {WORKSPACE_APPS.map((app) => {
        const Icon = app.icon;
        const active = activeWorkspaceTab === appTabValue(app.id);
        return (
          <Button
            key={app.id}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-[var(--radius-md)]",
              active && "bg-secondary text-foreground",
            )}
            aria-label={app.label}
            aria-current={active ? "page" : undefined}
            title={app.label}
            onClick={() => openAppTab(app.id)}
          >
            <Icon className="h-5 w-5" />
          </Button>
        );
      })}
    </nav>
  );
}
