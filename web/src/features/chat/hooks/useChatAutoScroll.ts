import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 80;

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

interface UseChatAutoScrollOptions {
  messagesLength: number;
  isTyping: boolean;
}

export function useChatAutoScroll({
  messagesLength,
  isTyping,
}: UseChatAutoScrollOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const forceScrollToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    setStickToBottom(true);
    setHasUnreadBelow(false);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleViewportScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const nearBottom = isNearBottom(el);
    stickToBottomRef.current = nearBottom;
    setStickToBottom(nearBottom);
    if (nearBottom) {
      setHasUnreadBelow(false);
    }
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleViewportScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleViewportScroll);
  }, [handleViewportScroll]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollToBottom();
      setHasUnreadBelow(false);
    } else {
      setHasUnreadBelow(true);
    }
  }, [messagesLength, isTyping, scrollToBottom]);

  return {
    viewportRef,
    stickToBottom,
    hasUnreadBelow,
    forceScrollToBottom,
  };
}
