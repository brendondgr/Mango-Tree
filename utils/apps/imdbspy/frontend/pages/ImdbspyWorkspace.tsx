import { useState } from "react";
import {
  Film,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  SearchX,
  Settings2,
} from "lucide-react";

import { AppHeader } from "@/components/app-shell/AppHeader";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { KindFilter, MediaItem, MediaStatus } from "@/types/imdbspy";

import { AddMediaDialog } from "@imdbspy/components/AddMediaDialog";
import { DeleteConfirmDialog } from "@imdbspy/components/DeleteConfirmDialog";
import { MediaCard } from "@imdbspy/components/MediaCard";
import { MediaRow } from "@imdbspy/components/MediaRow";
import {
  GRID_COLUMNS,
  MediaGridSkeleton,
  MediaListSkeleton,
} from "@imdbspy/components/MediaSkeletons";
import { ReviewDialog } from "@imdbspy/components/ReviewDialog";
import { WeightsDialog } from "@imdbspy/components/WeightsDialog";
import { useMedia, useRefreshMetadata } from "@imdbspy/hooks/useImdbspy";
import "@imdbspy/styles/imdbspy.css";

type LayoutMode = "grid" | "list";
type KindValue = KindFilter | "all";

const STATUS_SEGMENTS: Segment<MediaStatus>[] = [
  { value: "not_seen", label: "Not Seen" },
  { value: "seen", label: "Seen" },
  { value: "abandoned", label: "Abandoned" },
];

const KIND_SEGMENTS: Segment<KindValue>[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
];

const LAYOUTS: Array<{ value: LayoutMode; label: string; icon: typeof LayoutGrid }> =
  [
    { value: "grid", label: "Grid view", icon: LayoutGrid },
    { value: "list", label: "List view", icon: List },
  ];

export function ImdbspyWorkspace() {
  const [statusFilter, setStatusFilter] = useState<MediaStatus>("not_seen");
  const [kindFilter, setKindFilter] = useState<KindValue>("all");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<MediaItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MediaItem | null>(null);

  const refresh = useRefreshMetadata();

  const queryParams = {
    status: statusFilter,
    kind: kindFilter !== "all" ? kindFilter : undefined,
    search: search.trim() || undefined,
    limit: 200,
  };

  const { data, isLoading, isError, error, refetch } = useMedia(queryParams);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // Nothing-here and nothing-matched are different situations with different
  // exits: one wants the Add dialog, the other wants the filters cleared.
  const filtered = search.trim() !== "" || kindFilter !== "all";

  const refreshMessage = refresh.isError
    ? (refresh.error as Error).message
    : refresh.isSuccess
      ? `Refreshed metadata — ${refresh.data?.updated_count ?? 0} title${
          refresh.data?.updated_count === 1 ? "" : "s"
        } updated.`
      : null;

  const clearFilters = () => {
    setSearch("");
    setKindFilter("all");
  };

  return (
    <div
      // Container query, not viewport: app modules render inside a pane the
      // user resizes by dragging the chat sidebar, so the pane's own width is
      // the only honest breakpoint.
      style={{ containerType: "inline-size" }}
      className="flex min-h-0 w-full flex-1 flex-col bg-background text-foreground"
    >
      <AppHeader
        icon={Film}
        title="IMDbSpy"
        description="Your watchlist, rated on your own scale"
        nav={
          <SegmentedControl
            segments={STATUS_SEGMENTS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            label="Filter by watch status"
          />
        }
        actions={
          <>
            <Button onClick={() => setAddOpen(true)}>
              <Plus aria-hidden />
              Add
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              aria-label="Refresh metadata from IMDb"
              title="Refresh metadata from IMDb"
            >
              <RefreshCw
                className={cn(refresh.isPending && "motion-safe:animate-spin")}
                aria-hidden
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeightsOpen(true)}
              aria-label="Rating weights"
              title="Rating weights"
            >
              <Settings2 aria-hidden />
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface-1 px-3 py-2 @[48rem]:px-4">
        <p
          role="status"
          aria-live="polite"
          className="text-xs font-semibold tabular-nums text-muted-foreground"
        >
          {/* Same class of bug as the weights dialog: `total` falls back to 0,
              so a failed request used to report "0 titles" — the empty result,
              stated as fact — right above the boundary's error panel. */}
          {isLoading
            ? "Loading…"
            : isError
              ? "Couldn't load"
              : `${total} title${total !== 1 ? "s" : ""}`}
        </p>

        <SegmentedControl
          segments={KIND_SEGMENTS}
          value={kindFilter}
          onValueChange={setKindFilter}
          label="Filter by kind"
        />

        <Field
          label="Search titles"
          hideLabel
          // space-y-0: the sr-only label is still a flow child, and
          // Field's default space-y-1.5 would push the input off-centre
          // against the segmented control beside it.
          className="min-w-[9rem] flex-1 basis-48 space-y-0"
        >
          <Input
            type="search"
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-1" role="group" aria-label="Layout">
          {LAYOUTS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={layout === value ? "default" : "ghost"}
              size="icon"
              aria-pressed={layout === value}
              aria-label={label}
              title={label}
              onClick={() => setLayout(value)}
            >
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      </div>

      {/* The refresh mutation used to spin and then say nothing either way.
          The region stays mounted and merely swaps between `sr-only` and the
          visible banner: a `role="status"` element inserted at the same moment
          as its own text is frequently not announced at all. */}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          refreshMessage
            ? cn(
                "shrink-0 border-b border-border px-3 py-1.5 text-xs @[48rem]:px-4",
                refresh.isError
                  ? "bg-destructive/10 font-medium text-foreground"
                  : "bg-surface-1 text-muted-foreground",
              )
            : "sr-only",
        )}
      >
        {refreshMessage}
      </p>

      <AsyncBoundary
        loading={isLoading}
        error={isError ? error : undefined}
        empty={items.length === 0}
        onRetry={() => void refetch()}
        label="your library"
        skeleton={
          layout === "grid" ? <MediaGridSkeleton /> : <MediaListSkeleton />
        }
        emptyIcon={filtered ? SearchX : Film}
        emptyTitle={filtered ? "No matching titles" : "No titles yet"}
        emptyDescription={
          filtered
            ? "Nothing in this status matches the current search and kind filter."
            : "Add an IMDb URL or id and IMDbSpy will pull in the poster, cast and ratings."
        }
        emptyAction={
          filtered ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button onClick={() => setAddOpen(true)}>
              <Plus aria-hidden />
              Add titles
            </Button>
          )
        }
        className="min-h-0 flex-1 overflow-y-auto p-3 @[48rem]:p-4"
      >
        {layout === "grid" ? (
          <div className={cn("grid gap-3 @[48rem]:gap-4", GRID_COLUMNS)}>
            {items.map((item, i) => (
              <MediaCard
                key={item.id}
                item={item}
                index={i}
                onReview={setReviewItem}
                onDelete={setDeleteItem}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <MediaRow
                key={item.id}
                item={item}
                index={i}
                onReview={setReviewItem}
                onDelete={setDeleteItem}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>

      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} />
      <WeightsDialog open={weightsOpen} onOpenChange={setWeightsOpen} />
      <ReviewDialog
        item={reviewItem}
        onOpenChange={(open) => {
          if (!open) setReviewItem(null);
        }}
      />
      <DeleteConfirmDialog
        item={deleteItem}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      />
    </div>
  );
}
