import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMainBody } from "@/features/workspace/components/WorkspaceMainBody";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

function MobileSidebarBackdrop() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const mobileDrawerOpen = useWorkspaceStore((s) => s.mobileDrawerOpen);
  const setMobileDrawerOpen = useWorkspaceStore((s) => s.setMobileDrawerOpen);

  if (!isMobile) return null;

  return (
    <button
      type="button"
      className={cn(
        "fixed inset-0 z-[90] bg-foreground/60 transition-opacity duration-200",
        !mobileDrawerOpen ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      aria-hidden={!mobileDrawerOpen}
      tabIndex={mobileDrawerOpen ? 0 : -1}
      aria-label="Close sidebar"
      onClick={() => setMobileDrawerOpen(false)}
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
