import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { BottomNav } from "@/features/workspace/components/BottomNav";
import { CompactTopBar } from "@/features/workspace/components/CompactTopBar";
import { ChatNavRail } from "@/features/workspace/components/ChatNavRail";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMainBody } from "@/features/workspace/components/WorkspaceMainBody";
import { WorkspaceSidebarShell } from "@/features/workspace/components/WorkspaceSidebarShell";
import { useShellLayout } from "@/hooks/useShellLayout";
import { cn } from "@/lib/utils";

/**
 * Two shells, chosen by one breakpoint.
 *
 * The compact shell is a **view swap**, not an overlay. The previous one
 * layered a `position: fixed` wrapper over the whole viewport, which
 * intercepted every tap meant for the body, and put the drawer's own backdrop
 * at z-90 above the drawer at z-20, so the chat could be opened but never
 * used. Neither failure is expressible in this shape: there is exactly one
 * visible panel at a time, no scrim, and no fixed positioning.
 *
 * `utils/scripts/verify_mobile.py` is the gate for that claim — it hit-tests
 * what a tap actually lands on rather than trusting the CSS.
 */
export function AgentWorkspaceLayout() {
  const { isCompact, compactView } = useShellLayout();

  if (isCompact) {
    return (
      // dvh, not vh: mobile browser chrome makes 100vh taller than the visible
      // viewport at first paint, and the root is overflow-hidden, so the
      // difference is unreachable rather than merely off-screen.
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
        <SkipLink />
        <CompactTopBar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
        >
          {compactView === "chat" ? <ChatWindow /> : <WorkspaceMainBody />}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <SkipLink />
      <ChatNavRail />
      <WorkspaceSidebarShell>
        <ChatWindow />
      </WorkspaceSidebarShell>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none",
        )}
      >
        <WorkspaceHeader />
        <WorkspaceMainBody />
      </main>
    </div>
  );
}

/**
 * First tab stop on the page.
 *
 * Without it, reaching the content by keyboard meant tabbing past the rail's
 * nine app buttons and the whole chat panel on every single navigation.
 */
function SkipLink() {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-toast)]",
        "focus:rounded-[var(--radius-sm)] focus:bg-primary focus:px-4 focus:py-2",
        "focus:text-sm focus:font-medium focus:text-primary-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      )}
    >
      Skip to main content
    </a>
  );
}
