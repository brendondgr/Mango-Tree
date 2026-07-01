import { useState } from "react";
import { Film, Grid, LayoutList, Loader2, Plus, RefreshCw, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KindFilter, MediaItem, MediaStatus } from "@/types/imdbspy";

import { AddMediaDialog } from "@imdbspy/components/AddMediaDialog";
import { DeleteConfirmDialog } from "@imdbspy/components/DeleteConfirmDialog";
import { MediaCard } from "@imdbspy/components/MediaCard";
import { MediaRow } from "@imdbspy/components/MediaRow";
import { ReviewDialog } from "@imdbspy/components/ReviewDialog";
import { WeightsDialog } from "@imdbspy/components/WeightsDialog";
import { useMedia, useRefreshMetadata } from "@imdbspy/hooks/useImdbspy";
import "@imdbspy/styles/imdbspy.css";

type LayoutMode = "grid" | "list";

const STATUS_TABS: Array<{ value: MediaStatus; label: string }> = [
  { value: "not_seen", label: "Not Seen" },
  { value: "seen", label: "Seen" },
  { value: "abandoned", label: "Abandoned" },
];

const KIND_TABS: Array<{ value: KindFilter | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
];

export function ImdbspyWorkspace() {
  const [statusFilter, setStatusFilter] = useState<MediaStatus>("not_seen");
  const [kindFilter, setKindFilter] = useState<KindFilter | "all">("all");
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

  const { data, isLoading, isError, error } = useMedia(queryParams);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="imdbspy-app flex min-h-0 flex-1 flex-col bg-background">
      {/* Header */}
      <div className="imdbspy-header">
        <h1 className="imdbspy-title">
          <Film className="h-5 w-5 text-primary" />
          IMDbSpy
        </h1>

        {/* Status segmented control */}
        <div className="imdbspy-status-tabs" role="tablist" aria-label="Status filter">
          {STATUS_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              className="imdbspy-status-tab"
              data-active={statusFilter === value}
              aria-selected={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Add */}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            title="Refresh metadata from IMDb"
          >
            <RefreshCw
              className={`h-4 w-4 ${refresh.isPending ? "imdbspy-spin" : ""}`}
            />
          </Button>

          {/* Weights / settings */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Rating weights"
            onClick={() => setWeightsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Control bar */}
      <div className="imdbspy-controls">
        <span className="imdbspy-count">{isLoading ? "…" : `${total} title${total !== 1 ? "s" : ""}`}</span>

        {/* Kind filter */}
        <div className="imdbspy-filter-tabs" role="group" aria-label="Kind filter">
          {KIND_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="imdbspy-filter-tab"
              data-active={kindFilter === value}
              onClick={() => setKindFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Layout toggle */}
        <div className="imdbspy-layout-toggle" role="group" aria-label="Layout">
          <button
            type="button"
            className="imdbspy-layout-btn"
            data-active={layout === "grid"}
            title="Grid view"
            onClick={() => setLayout("grid")}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="imdbspy-layout-btn"
            data-active={layout === "list"}
            title="List view"
            onClick={() => setLayout("list")}
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="imdbspy-search">
          <Input
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="imdbspy-content">
        {isLoading ? (
          <div className="imdbspy-empty">
            <Loader2 className="h-8 w-8 imdbspy-spin imdbspy-empty-icon" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : isError ? (
          <div className="imdbspy-empty">
            <p className="text-sm text-destructive">
              {(error as Error).message}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="imdbspy-empty">
            <Film className="h-12 w-12 imdbspy-empty-icon" />
            <p className="text-sm font-semibold">No titles yet</p>
            <p className="text-xs">
              Click <strong>Add</strong> and paste an IMDb URL to get started.
            </p>
          </div>
        ) : layout === "grid" ? (
          <div className="imdbspy-grid">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onReview={setReviewItem}
                onDelete={setDeleteItem}
              />
            ))}
          </div>
        ) : (
          <div className="imdbspy-list">
            {items.map((item) => (
              <MediaRow
                key={item.id}
                item={item}
                onReview={setReviewItem}
                onDelete={setDeleteItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} />
      <WeightsDialog open={weightsOpen} onOpenChange={setWeightsOpen} />
      <ReviewDialog
        item={reviewItem}
        onOpenChange={(open) => { if (!open) setReviewItem(null); }}
      />
      <DeleteConfirmDialog
        item={deleteItem}
        onOpenChange={(open) => { if (!open) setDeleteItem(null); }}
      />
    </div>
  );
}
