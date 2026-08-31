import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import {
  SIDEBAR_DEFAULT,
  clampSidebarWidth,
  getSidebarMaxWidth,
} from "@/lib/shellGeometry";

const DRAG_THRESHOLD = 4;
const KEYBOARD_STEP = 24;

/**
 * Drag-to-resize for the desktop chat column.
 *
 * Desktop only: the compact shell has no resizable sidebar, so the mobile
 * branches this hook used to carry are gone. It drives the drag with pointer
 * events and `setPointerCapture` rather than four document-level mouse and
 * touch listeners, so a drag that leaves the handle mid-gesture still tracks.
 */
export function useSidebarResize() {
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const isResizingRef = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const commitWidth = useRef(0);

  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const lastWidth = useWorkspaceStore((s) => s.lastWidth);
  const setSidebarWidth = useWorkspaceStore((s) => s.setSidebarWidth);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const displayWidth = liveWidth ?? sidebarWidth;

  const beginResize = useCallback(
    (clientX: number) => {
      isResizingRef.current = true;
      setIsResizing(true);
      didDrag.current = false;
      startX.current = clientX;
      const current = sidebarWidth > 0 ? sidebarWidth : lastWidth;
      startWidth.current = current;
      commitWidth.current = current;
      setLiveWidth(current);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [lastWidth, sidebarWidth],
  );

  const onResizeMove = useCallback((clientX: number) => {
    if (!isResizingRef.current) return;
    const dx = clientX - startX.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) didDrag.current = true;
    const next = clampSidebarWidth(startWidth.current + dx);
    commitWidth.current = next;
    setLiveWidth(next);
  }, []);

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);
    setLiveWidth(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    // A click without movement toggles; a real drag commits the width.
    if (didDrag.current) {
      setSidebarWidth(commitWidth.current, getSidebarMaxWidth());
    } else {
      toggleSidebar(false);
    }
  }, [setSidebarWidth, toggleSidebar]);

  const expandSidebar = useCallback(() => {
    setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, getSidebarMaxWidth());
  }, [lastWidth, setSidebarWidth]);

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const max = getSidebarMaxWidth();
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSidebar(false);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (sidebarWidth === 0) {
        setSidebarWidth(lastWidth || SIDEBAR_DEFAULT, max);
        return;
      }
      const delta = event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP;
      setSidebarWidth(sidebarWidth + delta, max);
    },
    [lastWidth, setSidebarWidth, sidebarWidth, toggleSidebar],
  );

  useEffect(() => {
    if (!isResizing) return;
    const onPointerMove = (event: PointerEvent) => onResizeMove(event.clientX);
    const onPointerUp = () => endResize();
    // Listeners are attached only while a drag is in flight, rather than for
    // the lifetime of the component.
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [endResize, isResizing, onResizeMove]);

  useEffect(() => {
    const onWindowResize = () => {
      if (isResizingRef.current) return;
      const max = getSidebarMaxWidth();
      if (sidebarWidth > max) setSidebarWidth(max, max);
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [setSidebarWidth, sidebarWidth]);

  return {
    isResizing,
    displayWidth,
    beginResize,
    onHandleKeyDown,
    expandSidebar,
    collapseSidebar: () => setSidebarWidth(0),
    toggleSidebar: () => toggleSidebar(false),
  };
}
