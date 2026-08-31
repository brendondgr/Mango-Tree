import { Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/types/imdbspy";

import {
  GenrePill,
  KindBadge,
  RatingBadge,
} from "@imdbspy/components/MediaBadges";
import { Poster } from "@imdbspy/components/Poster";
import { StatusMenu } from "@imdbspy/components/StatusMenu";

interface MediaRowProps {
  item: MediaItem;
  /** Position in the list, for the staggered enter animation. */
  index?: number;
  onReview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

export function MediaRow({ item, index = 0, onReview, onDelete }: MediaRowProps) {
  const tv = item.kind === "tv";

  return (
    <div
      data-enter
      style={{ "--i": index } as CSSProperties}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-md)] border border-border bg-card p-2 shadow-xs transition-[border-color,box-shadow] duration-[var(--motion-duration-md)] ease-[var(--motion-ease-standard)] hover:border-primary/40 hover:shadow-sm focus-within:border-primary/40"
    >
      <Poster
        path={item.title_image_path}
        letter={item.title.charAt(0).toUpperCase()}
        className="h-16 w-11 shrink-0 rounded-[var(--radius-sm)] border border-border"
        letterClassName="text-sm"
      />

      <div className="flex min-w-[9rem] flex-1 flex-col gap-1">
        <p
          title={item.title}
          className="truncate text-sm font-bold text-foreground"
        >
          {item.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <KindBadge tv={tv} />
          {item.years ? <span className="tabular-nums">{item.years}</span> : null}
          {item.genres?.slice(0, 2).map((g) => (
            <GenrePill key={g}>{g}</GenrePill>
          ))}
          {item.rating !== null ? (
            <RatingBadge tone="imdb" value={item.rating} className="text-xs" />
          ) : null}
          {item.user_rating !== null ? (
            <RatingBadge tone="user" value={item.user_rating} className="text-xs" />
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <StatusMenu item={item} />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit rating and review for ${item.title}`}
          title="Write review"
          onClick={() => onReview(item)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${item.title} from library`}
          title="Remove"
          onClick={() => onDelete(item)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}
