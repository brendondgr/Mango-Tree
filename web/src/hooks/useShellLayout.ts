import {
  selectSidebarCollapsed,
  useWorkspaceStore,
  type CompactView,
} from "@/app/stores/workspaceStore";
import { MOBILE_BREAKPOINT } from "@/lib/shellGeometry";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The shell's layout state, in one place.
 *
 * The compact/expanded split used to be re-derived independently by
 * `AgentWorkspaceLayout`, `WorkspaceHeader`, `ChatNavRail` and
 * `useSidebarResize`, each calling `useMediaQuery` and each reconstructing
 * "is the chat visible" from raw store fields. They could and did disagree
 * mid-transition. Every shell component now reads from here.
 */
export interface ShellLayout {
  /** True below the app breakpoint: bottom navigation, full-screen chat. */
  isCompact: boolean;
  /** Which destination the compact shell is showing. */
  compactView: CompactView;
  setCompactView: (view: CompactView) => void;
  /** True when the chat panel is not currently visible, in either shell. */
  chatHidden: boolean;
  sidebarWidth: number;
  /** Show the chat: switches destination on compact, expands on desktop. */
  showChat: () => void;
}

export function useShellLayout(): ShellLayout {
  const isCompact = useMediaQuery(MOBILE_BREAKPOINT);
  const compactView = useWorkspaceStore((s) => s.compactView);
  const setCompactView = useWorkspaceStore((s) => s.setCompactView);
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const expandSidebar = useWorkspaceStore((s) => s.expandSidebar);

  const chatHidden = selectSidebarCollapsed(isCompact, {
    sidebarWidth,
    compactView,
  });

  return {
    isCompact,
    compactView,
    setCompactView,
    chatHidden,
    sidebarWidth,
    showChat: () => {
      if (isCompact) setCompactView("chat");
      else expandSidebar();
    },
  };
}
