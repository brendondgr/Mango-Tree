import { useEffect, useMemo, useState, type RefObject } from "react";

export function useContainedMediaSize(
  containerRef: RefObject<HTMLElement | null>,
  naturalWidth: number | null,
  naturalHeight: number | null,
) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  return useMemo(() => {
    if (
      naturalWidth == null ||
      naturalHeight == null ||
      naturalWidth <= 0 ||
      naturalHeight <= 0 ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return null;
    }

    const scale = Math.min(
      containerSize.width / naturalWidth,
      containerSize.height / naturalHeight,
    );

    return {
      width: Math.max(1, Math.floor(naturalWidth * scale)),
      height: Math.max(1, Math.floor(naturalHeight * scale)),
    };
  }, [containerSize.height, containerSize.width, naturalHeight, naturalWidth]);
}
