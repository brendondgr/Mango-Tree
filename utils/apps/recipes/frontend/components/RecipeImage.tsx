import { UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { accentColor } from "@recipes/utils/accent";

/**
 * A recipe photo, with a themed placeholder when there is none — or when the
 * one on file fails to load.
 *
 * The placeholder is a tint of the recipe's categorical accent rather than a
 * fixed grey, so it belongs to whichever theme is mounted. `alt` is only
 * attached to a real photo: the placeholder is decoration beside a title that
 * already names the recipe, so announcing it twice would be noise.
 */
export interface RecipeImageProps {
  src: string | null;
  alt: string;
  /** Seed for the placeholder tint — the cuisine when known, else the title. */
  seed: string;
  /** Aspect ratio, radius and sizing come from the caller. */
  className?: string;
  iconClassName?: string;
}

export function RecipeImage({
  src,
  alt,
  seed,
  className,
  iconClassName,
}: RecipeImageProps) {
  const [failed, setFailed] = useState(false);

  // A different recipe deserves a fresh attempt at its own image.
  useEffect(() => setFailed(false), [src]);

  const showPhoto = src != null && !failed;

  return (
    <div
      className={cn("relative overflow-hidden bg-surface-2", className)}
      style={showPhoto ? undefined : { backgroundColor: accentColor(seed, 0.18) }}
    >
      {showPhoto ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center"
          aria-hidden
        >
          <UtensilsCrossed
            className={cn("h-7 w-7", iconClassName)}
            style={{ color: accentColor(seed) }}
          />
        </span>
      )}
    </div>
  );
}
