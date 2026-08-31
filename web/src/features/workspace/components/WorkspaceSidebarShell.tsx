import type { ReactNode } from "react";

import { useSidebarResize } from "@/hooks/useSidebarResize";
import { SIDEBAR_MIN, getSidebarMaxWidth } from "@/lib/shellGeometry";
import { cn } from "@/lib/utils";

interface WorkspaceSidebarShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * The resizable chat column, desktop only.
 *
 * The compact shell renders the chat as a full-screen destination instead
 * (see `AgentWorkspaceLayout`), so every `position: fixed`, translate and
 * backdrop this component used to carry for mobile is gone along with the
 * two blockers they caused.
 */
export function WorkspaceSidebarShell({
  children,
  className,
}: WorkspaceSidebarShellProps) {
  const {
    isResizing,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    expandSidebar,
  } = useSidebarResize();

  const collapsed = displayWidth === 0;

  return (
    <div
      className={cn(
        "relative z-[var(--z-rail)] h-full shrink-0 overflow-hidden",
        !isResizing &&
          "motion-safe:transition-[width] motion-safe:duration-[var(--motion-duration-xl)] motion-safe:ease-[var(--motion-ease-standard)]",
        className,
      )}
      style={{ width: `${displayWidth}px` }}
    >
      <div
        role="separator"
        aria-label="Resize chat panel"
        aria-orientation="vertical"
        // A focusable separator must report its position, or assistive
        // technology has nothing to announce and axe flags it as missing a
        // required attribute.
        aria-valuenow={displayWidth}
        aria-valuemin={0}
        aria-valuemax={Math.round(getSidebarMaxWidth())}
        aria-valuetext={
          collapsed ? "Chat panel collapsed" : `Chat panel ${displayWidth} pixels wide`
        }
        tabIndex={0}
        className={cn(
          "group absolute top-0 z-10 flex h-full w-2.5 cursor-col-resize touch-none",
          "items-center justify-center gap-0.5 transition-colors hover:bg-primary/5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          collapsed ? "left-0" : "-right-[5px]",
        )}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          beginResize(event.clientX);
        }}
        onKeyDown={onHandleKeyDown}
        onDoubleClick={() => collapsed && expandSidebar()}
      >
        <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
        <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
      </div>

      <aside
        aria-label="Chat"
        // `inert` removes the whole subtree from the tab order and the
        // accessibility tree when collapsed. Previously a collapsed sidebar
        // kept roughly a dozen zero-width controls tabbable, so focus vanished
        // off-screen and Enter fired actions the user could not see.
        inert={collapsed || undefined}
        className={cn(
          "flex h-full flex-col overflow-hidden border-r border-border bg-card",
          "transition-opacity duration-150",
          collapsed && !isResizing && "pointer-events-none opacity-0",
        )}
        style={{ width: `${Math.max(displayWidth, SIDEBAR_MIN)}px` }}
      >
        {children}
      </aside>
    </div>
  );
}
