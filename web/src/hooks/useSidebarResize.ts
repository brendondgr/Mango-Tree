import { useCallback, useEffect, useRef } from "react";

import {
  SIDEBAR_CONSTRAINTS,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";

const DRAG_THRESHOLD = 4;

export function useSidebarResize(panelRef: React.RefObject<HTMLElement | null>) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const isResizing = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const setSidebarWidth = useWorkspaceStore((s) => s.setSidebarWidth);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const lastWidth = useWorkspaceStore((s) => s.lastWidth);

  const collapseSidebar = useCallback(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const expandSidebar = useCallback(() => {
    setSidebarCollapsed(false);
    if (!isMobile) {
      setSidebarWidth(lastWidth || SIDEBAR_CONSTRAINTS.default);
    }
  }, [isMobile, lastWidth, setSidebarCollapsed, setSidebarWidth]);

  const beginResize = useCallback(
    (clientX: number) => {
      if (isMobile) return;
      isResizing.current = true;
      didDrag.current = false;
      startX.current = clientX;
      const panel = panelRef.current;
      startWidth.current = sidebarCollapsed
        ? 0
        : panel?.offsetWidth ?? sidebarWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isMobile, panelRef, sidebarCollapsed, sidebarWidth],
  );

  const onResizeMove = useCallback(
    (clientX: number) => {
      if (!isResizing.current || isMobile) return;
      const dx = clientX - startX.current;
      if (Math.abs(dx) > DRAG_THRESHOLD) didDrag.current = true;
      const next = startWidth.current + dx;
      if (next < SIDEBAR_CONSTRAINTS.collapseAt) {
        collapseSidebar();
      } else {
        if (sidebarCollapsed) {
          setSidebarCollapsed(false);
        }
        setSidebarWidth(next);
      }
    },
    [
      collapseSidebar,
      isMobile,
      setSidebarCollapsed,
      setSidebarWidth,
      sidebarCollapsed,
    ],
  );

  const endResize = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (!didDrag.current) {
      toggleSidebar();
    }
  }, [toggleSidebar]);

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (sidebarCollapsed) expandSidebar();
        else setSidebarWidth(sidebarWidth - 24);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (sidebarCollapsed) expandSidebar();
        else setSidebarWidth(sidebarWidth + 24);
      }
    },
    [
      expandSidebar,
      setSidebarWidth,
      sidebarCollapsed,
      sidebarWidth,
      toggleSidebar,
    ],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onResizeMove(e.clientX);
    const onMouseUp = () => endResize();
    const onTouchMove = (e: TouchEvent) => {
      if (isResizing.current && e.touches[0]) {
        onResizeMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => endResize();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [endResize, onResizeMove]);

  const wasMobile = useRef(isMobile);

  useEffect(() => {
    if (isMobile && !wasMobile.current) {
      setSidebarCollapsed(true);
    } else if (!isMobile && wasMobile.current && !sidebarCollapsed) {
      setSidebarWidth(lastWidth || SIDEBAR_CONSTRAINTS.default);
    }
    wasMobile.current = isMobile;
  }, [
    isMobile,
    lastWidth,
    setSidebarCollapsed,
    setSidebarWidth,
    sidebarCollapsed,
  ]);

  return {
    isMobile,
    sidebarCollapsed,
    sidebarWidth,
    beginResize,
    onHandleKeyDown,
    collapseSidebar,
    expandSidebar,
    toggleSidebar,
  };
}
