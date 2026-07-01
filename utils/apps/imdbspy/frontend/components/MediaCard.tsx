import { Pencil, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { assetUrl } from "@/services/imdbspyClient";
import type { MediaItem } from "@/types/imdbspy";

import { StatusMenu } from "@imdbspy/components/StatusMenu";

interface MediaCardProps {
  item: MediaItem;
  onReview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

function PosterImage({ item }: { item: MediaItem }) {
  if (!item.title_image_path) {
    return (
      <div className="imdbspy-card-poster-fallback">
        {item.title.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
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
  );
}

function ActorThumb({ name, imgPath }: { name: string; imgPath: string | null }) {
  if (!imgPath) {
    return (
      <div className="imdbspy-actor-thumb" title={name}>
        <div className="imdbspy-actor-thumb-fallback">
          {name.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }
  return (
    <div className="imdbspy-actor-thumb" title={name}>
      <img
        src={assetUrl(imgPath)}
        alt={name}
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "flex";
        }}
      />
      <div className="imdbspy-actor-thumb-fallback" style={{ display: "none" }}>
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export function MediaCard({ item, onReview, onDelete }: MediaCardProps) {
  const cast = item.cast?.slice(0, 4) ?? [];

  return (
    <div className="imdbspy-card">
      {/* Poster */}
      <div className="imdbspy-card-poster">
        <PosterImage item={item} />
        <div className="imdbspy-card-poster-fallback" style={{ display: "none" }}>
          {item.title.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Body */}
      <div className="imdbspy-card-body">
        <p className="imdbspy-card-title">{item.title}</p>

        <div className="imdbspy-card-meta">
          <span
            className="imdbspy-kind-badge"
            data-kind={item.kind === "tv" ? "tv" : undefined}
          >
            {item.kind === "tv" ? "TV" : "Movie"}
          </span>
          {item.years ? <span>{item.years}</span> : null}
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

        {item.genres && item.genres.length > 0 ? (
          <div className="imdbspy-card-genres">
            {item.genres.slice(0, 3).map((g) => (
              <span key={g} className="imdbspy-genre-pill">{g}</span>
            ))}
          </div>
        ) : null}

        {cast.length > 0 ? (
          <div className="imdbspy-cast-row">
            {cast.map((person) => (
              <ActorThumb
                key={person.name}
                name={person.name}
                imgPath={item.actor_image_paths?.[person.name] ?? null}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="imdbspy-card-actions">
        <StatusMenu item={item} />
        <div className="flex gap-1">
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
    </div>
  );
}
