import { ExternalLink, Pencil, Star, Trash2 } from "lucide-react";

import { assetUrl } from "@/services/imdbspyClient";
import type { MediaItem, PersonRef } from "@/types/imdbspy";

import { StatusMenu } from "@imdbspy/components/StatusMenu";

interface MediaCardProps {
  item: MediaItem;
  onReview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

const isTv = (item: MediaItem) =>
  item.kind !== "movie" &&
  (item.kind?.toLowerCase().includes("tv") ||
    item.kind?.toLowerCase().includes("series"));

function personUrl(person: PersonRef): string | null {
  return person.id ? `https://www.imdb.com/name/nm${person.id}/` : null;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatAdded(iso: string | null): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.currentTarget;
  target.style.display = "none";
  const fallback = target.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = "flex";
}

/** A comma-separated list of people, each linked to IMDb when an id is known. */
function PeopleLine({ label, people }: { label: string; people: PersonRef[] }) {
  return (
    <div className="imdbspy-crew-line">
      <span className="imdbspy-crew-label">{label}</span>
      <span className="imdbspy-crew-names">
        {people.map((person, i) => {
          const url = personUrl(person);
          return (
            <span key={`${person.name}-${i}`}>
              {i > 0 ? ", " : ""}
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {person.name}
                </a>
              ) : (
                person.name
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
}

function ActorThumb({ person, imgPath }: { person: PersonRef; imgPath: string | null }) {
  const name = person.name;
  const url = personUrl(person);
  const photo = (
    <div className="imdbspy-actor-photo">
      {imgPath ? (
        <>
          <img src={assetUrl(imgPath)} alt={name} loading="lazy" onError={onImgError} />
          <div className="imdbspy-actor-fallback" style={{ display: "none" }}>
            {name.charAt(0).toUpperCase()}
          </div>
        </>
      ) : (
        <div className="imdbspy-actor-fallback">{name.charAt(0).toUpperCase()}</div>
      )}
    </div>
  );
  return (
    <div className="imdbspy-actor" title={name}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="imdbspy-actor-link">
          {photo}
          <span className="imdbspy-actor-name">{name}</span>
        </a>
      ) : (
        <>
          {photo}
          <span className="imdbspy-actor-name">{name}</span>
        </>
      )}
    </div>
  );
}

export function MediaCard({ item, onReview, onDelete }: MediaCardProps) {
  const tv = isTv(item);
  const seen = item.status === "seen" || item.status === "abandoned";
  const cast = item.cast?.slice(0, 5) ?? [];
  const genres = item.genres?.slice(0, 3) ?? [];
  const imdbUrl = `https://www.imdb.com/title/tt${item.imdb_id}/`;

  return (
    <div className="imdbspy-card">
      {/* Top: poster (sized to match this row's info block) + headline/desc/crew */}
      <div className="imdbspy-card-main">
        <div className="imdbspy-card-poster">
          <button
            type="button"
            className="imdbspy-card-delete"
            title="Remove from library"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {item.title_image_path ? (
            <>
              <img
                src={assetUrl(item.title_image_path)}
                alt={item.title}
                loading="lazy"
                onError={onImgError}
              />
              <div className="imdbspy-card-poster-fallback" style={{ display: "none" }}>
                {item.title.charAt(0).toUpperCase()}
              </div>
            </>
          ) : (
            <div className="imdbspy-card-poster-fallback">
              {item.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="imdbspy-card-info">
          {/* Headline + ratings */}
          <div className="imdbspy-card-top">
            <div className="imdbspy-card-headline">
              <h3 className="imdbspy-card-title" title={item.title}>
                {item.title}
              </h3>
              <div className="imdbspy-card-sub">
                <span>({item.years || "—"})</span>
                {!tv && item.runtime_minutes ? (
                  <>
                    <span>•</span>
                    <span>{formatRuntime(item.runtime_minutes)}</span>
                  </>
                ) : null}
              </div>
              <div className="imdbspy-card-tags">
                <span className="imdbspy-kind-badge" data-kind={tv ? "tv" : undefined}>
                  {tv ? "TV Series" : "Movie"}
                </span>
                {genres.map((g) => (
                  <span key={g} className="imdbspy-genre-pill">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div className="imdbspy-card-ratings">
              <div className="imdbspy-rating-badges">
                {seen && item.user_rating !== null ? (
                  <span className="imdbspy-rating-badge imdbspy-rating-user" title="Your rating">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {item.user_rating.toFixed(1)}
                  </span>
                ) : null}
                {item.rating !== null ? (
                  <span className="imdbspy-rating-badge imdbspy-rating-imdb" title="IMDb rating">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {item.rating.toFixed(1)}
                  </span>
                ) : null}
              </div>
              {item.rating_count ? (
                <span className="imdbspy-rating-count">
                  {item.rating_count.toLocaleString()} reviews
                </span>
              ) : null}
            </div>
          </div>

          {/* Description/crew (not seen) OR review (seen) */}
          {seen ? (
            item.user_review ? (
              <p className="imdbspy-card-review">“{item.user_review}”</p>
            ) : (
              <button
                type="button"
                className="imdbspy-card-review-prompt"
                onClick={() => onReview(item)}
              >
                + Write a review
              </button>
            )
          ) : (
            <>
              {item.description ? (
                <p className="imdbspy-card-desc">“{item.description}”</p>
              ) : null}

              <div className="imdbspy-card-crew">
                {tv && item.creators && item.creators.length > 0 ? (
                  <PeopleLine label="Created by" people={item.creators} />
                ) : null}
                {!tv && item.directors && item.directors.length > 0 ? (
                  <PeopleLine label="Directed by" people={item.directors} />
                ) : null}
                {!tv && item.writers && item.writers.length > 0 ? (
                  <PeopleLine label="Written by" people={item.writers} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cast: full-width row below the poster/info block */}
      {!seen && cast.length > 0 ? (
        <div className="imdbspy-card-cast">
          <div className="imdbspy-cast-label">Cast</div>
          <div className="imdbspy-cast-row">
            {cast.map((person) => (
              <ActorThumb
                key={person.name}
                person={person}
                imgPath={item.actor_image_paths?.[person.name] ?? null}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div className="imdbspy-card-footer">
        <div className="imdbspy-footer-left">
          <a
            href={imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="imdbspy-imdb-link"
            title="View on IMDb"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            IMDb
          </a>
          <div className="imdbspy-footer-stat">
            <span className="imdbspy-footer-stat-label">Added</span>
            <span className="imdbspy-footer-stat-value">{formatAdded(item.added_at)}</span>
          </div>
        </div>

        <div className="imdbspy-footer-right">
          {tv && item.seasons ? (
            <div className="imdbspy-footer-stat">
              <span className="imdbspy-footer-stat-label">Seasons</span>
              <span
                className="imdbspy-footer-stat-value"
                data-progress={item.seasons_seen != null ? "true" : undefined}
              >
                {item.seasons_seen != null
                  ? `${item.seasons_seen}/${item.seasons}`
                  : item.seasons}
              </span>
            </div>
          ) : null}
          {tv && item.episodes ? (
            <div className="imdbspy-footer-stat">
              <span className="imdbspy-footer-stat-label">Episodes</span>
              <span className="imdbspy-footer-stat-value">{item.episodes}</span>
            </div>
          ) : null}
          <StatusMenu item={item} />
          <button
            type="button"
            className="imdbspy-icon-btn"
            title="Edit rating & review"
            onClick={() => onReview(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
