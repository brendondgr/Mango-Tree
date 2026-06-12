import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  clampViewerMediaFraction,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";

const DRAG_THRESHOLD = 4;

export function useViewerSplitResize(containerRef: RefObject<HTMLElement | null>) {
  const [isResizing, setIsResizing] = useState(false);
  const [liveFraction, setLiveFraction] = useState<number | null>(null);
  const isResizingRef = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const startFraction = useRef(0);
  const commitFractionRef = useRef(0);

  const viewerMediaFraction = useWorkspaceStore((s) => s.viewerMediaFraction);
  const setViewerMediaFraction = useWorkspaceStore((s) => s.setViewerMediaFraction);

  const displayFraction = liveFraction ?? viewerMediaFraction;

  const beginResize = useCallback(
    (clientY: number) => {
      isResizingRef.current = true;
      setIsResizing(true);
      didDrag.current = false;
      startY.current = clientY;
      startFraction.current = viewerMediaFraction;
      commitFractionRef.current = viewerMediaFraction;
      setLiveFraction(viewerMediaFraction);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [viewerMediaFraction],
  );

  const onResizeMove = useCallback(
    (clientY: number) => {
      if (!isResizingRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const dy = clientY - startY.current;
      if (Math.abs(dy) > DRAG_THRESHOLD) didDrag.current = true;

      const containerHeight = container.getBoundingClientRect().height;
      if (containerHeight <= 0) return;

      const deltaFraction = dy / containerHeight;
      const next = clampViewerMediaFraction(startFraction.current + deltaFraction);
      commitFractionRef.current = next;
      setLiveFraction(next);
    },
    [containerRef],
  );

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);
    setLiveFraction(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (didDrag.current) {
      setViewerMediaFraction(commitFractionRef.current);
    }
  }, [setViewerMediaFraction]);

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

  return {
    isResizing,
    displayFraction,
    beginResize,
  };
}
