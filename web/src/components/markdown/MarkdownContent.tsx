import { Suspense, lazy } from "react";

import type { MarkdownContentProps } from "@/components/markdown/MarkdownContentImpl";
import { cn } from "@/lib/utils";

/**
 * Lazy boundary around the markdown renderer.
 *
 * The implementation pulls in react-markdown, the remark/rehype chain, KaTeX
 * (plus its stylesheet and font files) and highlight.js. None of that is needed
 * to paint the login screen, the app launcher, or any app module that is not
 * showing prose — but a static import put all of it in the entry chunk.
 *
 * The fallback renders the raw source as preformatted text rather than a
 * spinner or nothing: markdown degrades legibly, so a reader still gets the
 * content while the chunk arrives, and it can never end up blank.
 */
const MarkdownContentImpl = lazy(async () => ({
  default: (await import("@/components/markdown/MarkdownContentImpl"))
    .MarkdownContent,
}));

export type { MarkdownContentProps };

export function MarkdownContent(props: MarkdownContentProps) {
  return (
    <Suspense fallback={<MarkdownFallback {...props} />}>
      <MarkdownContentImpl {...props} />
    </Suspense>
  );
}

function MarkdownFallback({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "min-w-0 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]",
        className,
      )}
    >
      {content}
    </div>
  );
}
