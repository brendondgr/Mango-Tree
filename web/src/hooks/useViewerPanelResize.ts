import { useCallback, useEffect, useRef, useState } from "react";

import {
  clampViewerPropertiesHeight,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";

const DRAG_THRESHOLD = 4;

export function useViewerPanelResize() {
  const [isResizing, setIsResizing] = useState(false);
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const isResizingRef = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const commitHeightRef = useRef(0);

  const viewerPropertiesHeight = useWorkspaceStore((s) => s.viewerPropertiesHeight);
  const setViewerPropertiesHeight = useWorkspaceStore(
    (s) => s.setViewerPropertiesHeight,
  );

  const displayHeight = liveHeight ?? viewerPropertiesHeight;

  const beginResize = useCallback(
    (clientY: number) => {
      isResizingRef.current = true;
      setIsResizing(true);
      didDrag.current = false;
      startY.current = clientY;
      startHeight.current = viewerPropertiesHeight;
      commitHeightRef.current = viewerPropertiesHeight;
      setLiveHeight(viewerPropertiesHeight);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [viewerPropertiesHeight],
  );

  const onResizeMove = useCallback((clientY: number) => {
    if (!isResizingRef.current) return;
    const dy = startY.current - clientY;
    if (Math.abs(dy) > DRAG_THRESHOLD) didDrag.current = true;
    const next = clampViewerPropertiesHeight(startHeight.current + dy);
    commitHeightRef.current = next;
    setLiveHeight(next);
  }, []);

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);
    setLiveHeight(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (didDrag.current) {
      setViewerPropertiesHeight(commitHeightRef.current);
    }
  }, [setViewerPropertiesHeight]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onResizeMove(e.clientY);
    const onMouseUp = () => endResize();
    const onTouchMove = (e: TouchEvent) => {
      if (isResizingRef.current && e.touches[0]) {
        onResizeMove(e.touches[0].clientY);
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

  useEffect(() => {
    const onWindowResize = () => {
      if (isResizingRef.current) return;
      const clamped = clampViewerPropertiesHeight(viewerPropertiesHeight);
      if (clamped !== viewerPropertiesHeight) {
        setViewerPropertiesHeight(clamped);
      }
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [setViewerPropertiesHeight, viewerPropertiesHeight]);

  return {
    isResizing,
    displayHeight,
    beginResize,
  };
}
