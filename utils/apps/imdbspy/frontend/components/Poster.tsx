import { useState } from "react";

import { assetUrl } from "@/services/imdbspyClient";
import { cn } from "@/lib/utils";

/**
 * A cached image with an initial-letter fallback.
 *
 * The previous version handled a broken image by reaching into the DOM on
 * error — hiding the `<img>` and setting `display: flex` on
 * `nextElementSibling`. That made the fallback's visibility invisible to React
 * (a re-render restored the broken image) and coupled the component to its own
 * sibling order. One piece of state replaces it.
 *
 * The image is decorative: every caller renders the title or the person's name
 * as text beside it, so an `alt` would be a duplicate announcement.
 */
export function Poster({
  path,
  letter,
  className,
  letterClassName,
}: {
  path: string | null | undefined;
  letter: string;
  /** Sizing and shape. The image absolutely fills whatever box you give it. */
  className?: string;
  letterClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(path) && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {showImage ? (
        <img
          src={assetUrl(path as string)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-center font-extrabold text-muted-foreground",
            letterClassName,
          )}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
