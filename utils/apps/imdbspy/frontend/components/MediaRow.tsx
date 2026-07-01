import { Pencil, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { assetUrl } from "@/services/imdbspyClient";
import type { MediaItem } from "@/types/imdbspy";

import { StatusMenu } from "@imdbspy/components/StatusMenu";

interface MediaRowProps {
  item: MediaItem;
  onReview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

function RowThumb({ item }: { item: MediaItem }) {
  if (!item.title_image_path) {
    return (
      <div className="imdbspy-row-thumb">
        <div className="imdbspy-row-thumb-fallback">
          {item.title.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }
  return (
    <div className="imdbspy-row-thumb">
      <img
        src={assetUrl(item.title_image_path)}
        alt={item.title}
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "flex";
        }}
      />
      <div className="imdbspy-row-thumb-fallback" style={{ display: "none" }}>
        {item.title.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export function MediaRow({ item, onReview, onDelete }: MediaRowProps) {
  return (
    <div className="imdbspy-row">
      <RowThumb item={item} />

      <div className="imdbspy-row-body">
        <p className="imdbspy-row-title">{item.title}</p>
        <div className="imdbspy-row-meta">
          <span
            className="imdbspy-kind-badge"
            data-kind={item.kind === "tv" ? "tv" : undefined}
          >
            {item.kind === "tv" ? "TV" : "Movie"}
          </span>
          {item.years ? <span>{item.years}</span> : null}
          {item.genres?.slice(0, 2).map((g) => (
            <span key={g} className="imdbspy-genre-pill">{g}</span>
          ))}
          {item.rating !== null ? (
            <span className="imdbspy-card-rating">
              <Star className="h-3 w-3 fill-current" />
              {item.rating.toFixed(1)}
            </span>
          ) : null}
          {item.user_rating !== null ? (
            <span className="imdbspy-card-user-rating">
              <Star className="h-3 w-3 fill-current" />
              {item.user_rating.toFixed(1)} you
            </span>
          ) : null}
        </div>
      </div>

      <div className="imdbspy-row-actions">
        <StatusMenu item={item} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Write review"
          onClick={() => onReview(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          title="Remove"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
