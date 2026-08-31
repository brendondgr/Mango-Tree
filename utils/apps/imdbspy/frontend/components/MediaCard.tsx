import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaItem, PersonRef } from "@/types/imdbspy";

import {
  GenrePill,
  KindBadge,
  RatingBadge,
  categoryStyle,
} from "@imdbspy/components/MediaBadges";
import { Poster } from "@imdbspy/components/Poster";
import { StatusMenu } from "@imdbspy/components/StatusMenu";

interface MediaCardProps {
  item: MediaItem;
  /** Position in the grid, for the staggered enter animation. */
  index?: number;
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

/**
 * An inline link inside running text.
 *
 * `inline-flex` with a 24px minimum is what keeps a 12px crew name from being
 * a 16px-tall tap target while still flowing inside the sentence.
 */
const INLINE_LINK =
  "inline-flex min-h-6 items-center rounded-[var(--radius-sm)] px-0.5 underline-offset-2 hover:text-primary-emphasis hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A comma-separated list of people, each linked to IMDb when an id is known. */
function PeopleLine({ label, people }: { label: string; people: PersonRef[] }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 pt-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-xs leading-6 text-foreground">
        {people.map((person, i) => {
          const url = personUrl(person);
          return (
            <span key={`${person.name}-${i}`}>
              {i > 0 ? ", " : ""}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={INLINE_LINK}
                >
                  {person.name}
                </a>
              ) : (
                person.name
              )}
            </span>
          );
        })}
      </dd>
    </div>
  );
}

function ActorThumb({
  person,
  imgPath,
}: {
  person: PersonRef;
  imgPath: string | null;
}) {
  const url = personUrl(person);
  const inner = (
    <>
      <Poster
        path={imgPath}
        letter={person.name.charAt(0).toUpperCase()}
        className="h-12 w-12 rounded-[var(--radius-pill)] border border-border"
        letterClassName="text-base"
      />
      <span className="line-clamp-2 text-center text-[0.625rem] leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
        {person.name}
      </span>
    </>
  );

  const shell = "flex w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-[var(--radius-md)] p-1";

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={person.name}
      className={cn(
        shell,
        "group transition-colors hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {inner}
    </a>
  ) : (
    <div className={shell} title={person.name}>
      {inner}
    </div>
  );
}

/** A label/value pair in the card footer. */
function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[0.5625rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-xs tabular-nums",
          // Weight, not hue: the `--category-*` scale is identical on the light
          // and dark themes, so a token used as 12px text fails contrast on
          // half of them.
          emphasis ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MediaCard({ item, index = 0, onReview, onDelete }: MediaCardProps) {
  const tv = isTv(item);
  const seen = item.status === "seen" || item.status === "abandoned";
  const cast = item.cast?.slice(0, 5) ?? [];
  const genres = item.genres?.slice(0, 3) ?? [];
  const imdbUrl = `https://www.imdb.com/title/tt${item.imdb_id}/`;

  return (
    <article
      data-enter
      // A container query, not a viewport one: this card lives in a pane the
      // user resizes by dragging the chat sidebar.
      style={{ "--i": index, containerType: "inline-size" } as CSSProperties}
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-xs",
        "transition-[border-color,box-shadow] duration-[var(--motion-duration-md)] ease-[var(--motion-ease-standard)]",
        "hover:border-primary/40 hover:shadow-md focus-within:border-primary/40",
      )}
    >
      <div className="flex">
        <Poster
          path={item.title_image_path}
          letter={item.title.charAt(0).toUpperCase()}
          // A definite width plus `self-stretch` lets the poster follow the
          // info column's height instead of dragging the row to its own
          // intrinsic aspect ratio; `object-cover` keeps it looking ~2:3.
          className="w-[32%] min-w-[5rem] max-w-[11.875rem] shrink-0 self-stretch"
          letterClassName="text-4xl"
        />

        <div className="flex min-h-[11.25rem] min-w-0 flex-1 flex-col justify-center gap-2 p-3 @[26rem]:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                title={item.title}
                className="text-[0.95rem] font-bold leading-tight text-foreground @[26rem]:text-base"
              >
                {item.title}
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>({item.years || "—"})</span>
                {!tv && item.runtime_minutes ? (
                  <>
                    <span aria-hidden>•</span>
                    <span>{formatRuntime(item.runtime_minutes)}</span>
                  </>
                ) : null}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <KindBadge tv={tv} />
                {genres.map((g) => (
                  <GenrePill key={g}>{g}</GenrePill>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                {seen && item.user_rating !== null ? (
                  <RatingBadge tone="user" value={item.user_rating} />
                ) : null}
                {item.rating !== null ? (
                  <RatingBadge tone="imdb" value={item.rating} />
                ) : null}
              </div>
              {item.rating_count ? (
                <span className="text-[0.625rem] tabular-nums text-muted-foreground">
                  {item.rating_count.toLocaleString()} reviews
                </span>
              ) : null}
            </div>
          </div>

          {seen ? (
            item.user_review ? (
              <p className="line-clamp-3 text-sm italic leading-relaxed text-muted-foreground">
                “{item.user_review}”
              </p>
            ) : (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => onReview(item)}
              >
                <Pencil aria-hidden />
                Write a review
              </Button>
            )
          ) : (
            <>
              {item.description ? (
                <p className="line-clamp-3 text-sm italic leading-relaxed text-muted-foreground">
                  “{item.description}”
                </p>
              ) : null}

              <dl className="flex flex-col gap-0.5">
                {tv && item.creators && item.creators.length > 0 ? (
                  <PeopleLine label="Created by" people={item.creators} />
                ) : null}
                {!tv && item.directors && item.directors.length > 0 ? (
                  <PeopleLine label="Directed by" people={item.directors} />
                ) : null}
                {!tv && item.writers && item.writers.length > 0 ? (
                  <PeopleLine label="Written by" people={item.writers} />
                ) : null}
              </dl>
            </>
          )}
        </div>
      </div>

      {!seen && cast.length > 0 ? (
        <div className="flex flex-col gap-1.5 px-3 pb-3 @[26rem]:px-4">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Cast
          </p>
          {/* `.scroll-region` keeps its own overflow and is keyboard-scrollable,
              rather than being clipped by an overflow-hidden ancestor. */}
          <div
            className="scroll-region flex gap-1 pb-1"
            tabIndex={0}
            role="group"
            aria-label={`Cast of ${item.title}`}
          >
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

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-3 py-2 @[26rem]:px-4">
        {/* Everything but href/target/rel goes on Button: `asChild` merges the
            two class strings by concatenation, not by tailwind-merge, so a
            utility placed on the anchor would race the variant's own. */}
        <Button
          asChild
          variant="ghost"
          style={categoryStyle("amber")}
          className="border border-[hsl(var(--c)/0.5)] bg-[hsl(var(--c)/0.16)] px-2 text-[0.6875rem] font-bold uppercase tracking-wide text-foreground"
        >
          <a href={imdbUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            IMDb
            <span className="sr-only"> — open {item.title} on IMDb</span>
          </a>
        </Button>

        <Stat label="Added" value={formatAdded(item.added_at)} />

        {tv && item.seasons ? (
          <Stat
            label="Seasons"
            value={
              item.seasons_seen != null
                ? `${item.seasons_seen}/${item.seasons}`
                : String(item.seasons)
            }
            emphasis={item.seasons_seen != null}
          />
        ) : null}
        {tv && item.episodes ? (
          <Stat label="Episodes" value={String(item.episodes)} />
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <StatusMenu item={item} />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit rating and review for ${item.title}`}
            title="Edit rating & review"
            onClick={() => onReview(item)}
          >
            <Pencil aria-hidden />
          </Button>
          {/* Was a 30px transparent circle revealed only on `:hover`, sitting
              over the top-left of the poster — invisible on touch, and the
              first tap that landed there fired the destructive flow while the
              user believed they had tapped the poster. It is now a permanent,
              labelled control in the action row, and it still routes through
              the confirm dialog. */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${item.title} from library`}
            title="Remove from library"
            onClick={() => onDelete(item)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}
