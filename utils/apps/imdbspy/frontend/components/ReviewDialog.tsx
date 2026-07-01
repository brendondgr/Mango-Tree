import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { MediaItem, ReviewInput, ScaleType } from "@/types/imdbspy";
import { SCALE_CRITERIA } from "@/types/imdbspy";

import { useUpdateReview } from "@imdbspy/hooks/useImdbspy";

interface ReviewDialogProps {
  item: MediaItem | null;
  onOpenChange: (open: boolean) => void;
}

type CriterionKey =
  | "entertaining_rating"
  | "momentum_rating"
  | "characters_rating"
  | "rewatchability_rating"
  | "immersive_rating"
  | "stakes_rating"
  | "heart_rating";

const CRITERION_TO_KEY: Record<string, CriterionKey> = {
  entertaining: "entertaining_rating",
  momentum: "momentum_rating",
  characters: "characters_rating",
  rewatchability: "rewatchability_rating",
  immersive: "immersive_rating",
  stakes: "stakes_rating",
  heart: "heart_rating",
};

const SCALE_LABELS: Record<ScaleType, string> = {
  fun: "Fun",
  grit: "Grit",
  comfort: "Comfort",
};

function buildInitialRatings(item: MediaItem): Record<CriterionKey, number> {
  return {
    entertaining_rating: item.entertaining_rating ?? 0,
    momentum_rating: item.momentum_rating ?? 0,
    characters_rating: item.characters_rating ?? 0,
    rewatchability_rating: item.rewatchability_rating ?? 0,
    immersive_rating: item.immersive_rating ?? 0,
    stakes_rating: item.stakes_rating ?? 0,
    heart_rating: item.heart_rating ?? 0,
  };
}

export function ReviewDialog({ item, onOpenChange }: ReviewDialogProps) {
  const updateReview = useUpdateReview();

  const [scaleType, setScaleType] = useState<ScaleType>("fun");
  const [ratings, setRatings] = useState<Record<CriterionKey, number>>({
    entertaining_rating: 0,
    momentum_rating: 0,
    characters_rating: 0,
    rewatchability_rating: 0,
    immersive_rating: 0,
    stakes_rating: 0,
    heart_rating: 0,
  });
  const [reviewText, setReviewText] = useState("");
  const [seasonsSeen, setSeasonsSeen] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setScaleType(item.scale_type ?? "fun");
    setRatings(buildInitialRatings(item));
    setReviewText(item.user_review ?? "");
    setSeasonsSeen(item.seasons_seen ?? 0);
    setError(null);
  }, [item]);

  const criteria = SCALE_CRITERIA[scaleType];

  const handleSubmit = () => {
    if (!item) return;
    setError(null);

    const input: ReviewInput = {
      scale_type: scaleType,
      user_review: reviewText.trim() || undefined,
    };

    for (const criterion of criteria) {
      const key = CRITERION_TO_KEY[criterion];
      if (key) {
        (input as Record<string, unknown>)[key] = ratings[key];
      }
    }

    if (item.kind === "tv") {
      input.seasons_seen = seasonsSeen;
    }

    updateReview.mutate(
      { id: item.id, input },
      {
        onSuccess: (updated) => {
          // Show computed rating briefly then close
          setError(null);
          // Update display of computed rating
          if (updated.user_rating !== null) {
            setError(`Saved! Your rating: ${updated.user_rating.toFixed(1)} / 10`);
          }
          onOpenChange(false);
        },
        onError: (err) => setError((err as Error).message),
      },
    );
  };

  if (!item) return null;

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="imdbspy-app max-w-lg">
        <DialogHeader>
          <DialogTitle>Review: {item.title}</DialogTitle>
          <DialogDescription>
            Rate this title and write your thoughts.
          </DialogDescription>
        </DialogHeader>

        <div className="imdbspy-dialog-body">
          {/* Scale picker */}
          <div className="imdbspy-field">
            <Label>Rating Scale</Label>
            <div className="imdbspy-scale-tabs">
              {(["fun", "grit", "comfort"] as ScaleType[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="imdbspy-scale-tab"
                  data-active={scaleType === s}
                  onClick={() => setScaleType(s)}
                >
                  {SCALE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Criterion sliders */}
          <div className="imdbspy-field">
            <Label>Criteria (0–5)</Label>
            <div className="flex flex-col gap-2 pt-1">
              {criteria.map((criterion) => {
                const key = CRITERION_TO_KEY[criterion];
                if (!key) return null;
                return (
                  <div key={criterion} className="imdbspy-slider-row">
                    <span className="imdbspy-slider-label">{criterion}</span>
                    <input
                      type="range"
                      className="imdbspy-slider"
                      min={0}
                      max={5}
                      step={0.5}
                      value={ratings[key]}
                      onChange={(e) =>
                        setRatings((prev) => ({
                          ...prev,
                          [key]: parseFloat(e.target.value),
                        }))
                      }
                    />
                    <span className="imdbspy-slider-value">{ratings[key]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seasons seen (TV only) */}
          {item.kind === "tv" && item.seasons !== null ? (
            <div className="imdbspy-field">
              <Label htmlFor="imdbspy-seasons-seen">
                Seasons Seen (0–{item.seasons})
              </Label>
              <input
                id="imdbspy-seasons-seen"
                type="number"
                min={0}
                max={item.seasons}
                value={seasonsSeen}
                onChange={(e) => setSeasonsSeen(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-24 rounded border border-border bg-muted px-2 py-1 text-sm text-foreground"
              />
            </div>
          ) : null}

          {/* Review text */}
          <div className="imdbspy-field">
            <Label htmlFor="imdbspy-review-text">Your Review (optional)</Label>
            <textarea
              id="imdbspy-review-text"
              className="imdbspy-textarea"
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write your thoughts…"
              disabled={updateReview.isPending}
            />
          </div>

          {/* Error / info */}
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {/* Existing rating */}
          {item.user_rating !== null ? (
            <div className="imdbspy-computed-rating">
              Current rating: {item.user_rating.toFixed(1)} / 10
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateReview.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateReview.isPending}>
            {updateReview.isPending ? "Saving…" : "Save Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
