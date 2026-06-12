import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSidebarMaxWidth,
  clampSidebarWidth,
  SIDEBAR_DEFAULT,
  selectSidebarCollapsed,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";

const DRAG_THRESHOLD = 4;

export function useSidebarResize() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const isResizingRef = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const commitWidthRef = useRef(0);

  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const mobileDrawerOpen = useWorkspaceStore((s) => s.mobileDrawerOpen);
  const setSidebarWidth = useWorkspaceStore((s) => s.setSidebarWidth);
  const setMobileDrawerOpen = useWorkspaceStore((s) => s.setMobileDrawerOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const lastWidth = useWorkspaceStore((s) => s.lastWidth);

  const displayWidth = liveWidth ?? sidebarWidth;

  const sidebarCollapsed = selectSidebarCollapsed(isMobile, {
    sidebarWidth,
    mobileDrawerOpen,
  });

  const beginResize = useCallback(
    (clientX: number) => {
      if (isMobile) return;
      isResizingRef.current = true;
      setIsResizing(true);
      didDrag.current = false;
      startX.current = clientX;
      const current = sidebarWidth > 0 ? sidebarWidth : lastWidth;
      startWidth.current = current;
      commitWidthRef.current = current;
      setLiveWidth(current);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isMobile, lastWidth, sidebarWidth],
  );

  const onResizeMove = useCallback(
    (clientX: number) => {
      if (!isResizingRef.current || isMobile) return;
      const dx = clientX - startX.current;
      if (Math.abs(dx) > DRAG_THRESHOLD) didDrag.current = true;
      const next = clampSidebarWidth(startWidth.current + dx);
      commitWidthRef.current = next;
      setLiveWidth(next);
    },
    [isMobile],
  );

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);
    setLiveWidth(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (didDrag.current) {
      setSidebarWidth(commitWidthRef.current, getSidebarMaxWidth());
    } else {
      toggleSidebar(false);
    }
  }, [setSidebarWidth, toggleSidebar]);

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isMobile) return;
      const max = getSidebarMaxWidth();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSidebar(false);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (sidebarWidth === 0) {
          setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, max);
        } else {
          setSidebarWidth(sidebarWidth - 24, max);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (sidebarWidth === 0) {
          setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, max);
        } else {
          setSidebarWidth(sidebarWidth + 24, max);
        }
      }
    },
    [isMobile, lastWidth, setSidebarWidth, sidebarWidth, toggleSidebar],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onResizeMove(e.clientX);
    const onMouseUp = () => endResize();
    const onTouchMove = (e: TouchEvent) => {
      if (isResizingRef.current && e.touches[0]) {
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
      setMobileDrawerOpen(false);
    } else if (!isMobile && wasMobile.current && sidebarWidth > 0) {
      setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, getSidebarMaxWidth());
    }
    wasMobile.current = isMobile;
  }, [isMobile, lastWidth, setMobileDrawerOpen, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    const onWindowResize = () => {
      if (isMobile || isResizingRef.current) return;
      const max = getSidebarMaxWidth();
      if (sidebarWidth > max) {
        setSidebarWidth(max, max);
      }
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [isMobile, setSidebarWidth, sidebarWidth]);

  return {
    isMobile,
    isResizing,
    sidebarCollapsed,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    collapseSidebar: () =>
      isMobile ? setMobileDrawerOpen(false) : setSidebarWidth(0),
    expandSidebar: () =>
      isMobile
        ? setMobileDrawerOpen(true)
        : setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, getSidebarMaxWidth()),
    toggleSidebar: () => toggleSidebar(isMobile),
  };
}
