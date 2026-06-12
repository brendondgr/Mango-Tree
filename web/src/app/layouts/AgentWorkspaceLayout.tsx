import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMainBody } from "@/features/workspace/components/WorkspaceMainBody";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

function MobileSidebarBackdrop() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);

  if (!isMobile) return null;

  return (
    <button
      type="button"
      className={cn(
        "fixed inset-0 z-[90] bg-foreground/60 transition-opacity duration-200",
        sidebarCollapsed
          ? "pointer-events-none opacity-0"
          : "opacity-100",
      )}
      aria-hidden={sidebarCollapsed}
      tabIndex={sidebarCollapsed ? -1 : 0}
      aria-label="Close sidebar"
      onClick={() => setSidebarCollapsed(true)}
    />
  );
}

export function AgentWorkspaceLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <MobileSidebarBackdrop />
      <ChatWindow />
      <main className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader />
        <WorkspaceMainBody />
      </main>
    </div>
  );
}
