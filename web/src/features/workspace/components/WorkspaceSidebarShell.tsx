import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSidebarResize } from "@/hooks/useSidebarResize";

interface WorkspaceSidebarShellProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceSidebarShell({
  children,
  className,
}: WorkspaceSidebarShellProps) {
  const {
    isMobile,
    isResizing,
    sidebarCollapsed,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    collapseSidebar,
  } = useSidebarResize();

  const mobileWidth = "min(92vw, 360px)";
  const desktopWidth = `${displayWidth}px`;

  return (
    <div
      className={cn(
        "relative z-20 h-full shrink-0 overflow-hidden",
        !isResizing &&
          "transition-[width] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        isMobile && "fixed left-[52px] top-0 shadow-xl max-[820px]:left-0 max-[820px]:top-11",
        isMobile && sidebarCollapsed && "-translate-x-full",
        isMobile && !sidebarCollapsed && "translate-x-0",
        isMobile &&
          "transition-[transform] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        className,
      )}
      style={{ width: isMobile ? mobileWidth : desktopWidth }}
    >
      {!isMobile && (
        <div
          role="separator"
          aria-label="Resize sidebar — drag to adjust, click to collapse or expand"
          aria-orientation="vertical"
          tabIndex={0}
          className={cn(
            "absolute -right-[5px] top-0 z-30 flex h-full w-2.5 cursor-col-resize touch-none items-center justify-center gap-0.5 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            displayWidth === 0 &&
              !isResizing &&
              "fixed left-[52px] bg-primary/[0.04]",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            beginResize(e.clientX);
          }}
          onKeyDown={onHandleKeyDown}
        >
          <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
          <span className="h-9 w-px rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>
      )}

      <aside
        className={cn(
          "flex h-full flex-col overflow-hidden border-r border-border bg-card transition-opacity duration-150",
          !isMobile &&
            displayWidth === 0 &&
            !isResizing &&
            "pointer-events-none opacity-0",
        )}
        style={{ width: isMobile ? mobileWidth : desktopWidth }}
      >
        {children}
      </aside>

      {isMobile && !sidebarCollapsed && (
        <button
          type="button"
          className="sr-only"
          onClick={collapseSidebar}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}
