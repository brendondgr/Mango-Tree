import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { ChatNavRail } from "@/features/workspace/components/ChatNavRail";
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
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <MobileSidebarBackdrop />
      <div
        className={cn(
          "flex h-full shrink-0",
          isMobile && "fixed inset-x-0 top-0 z-20 flex-col",
        )}
      >
        <ChatNavRail />
        <ChatWindow />
      </div>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-[820px]:pt-11">
        <WorkspaceHeader />
        <WorkspaceMainBody />
      </main>
    </div>
  );
}
