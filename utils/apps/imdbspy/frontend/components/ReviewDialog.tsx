import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MediaItem, ReviewInput, ScaleType } from "@/types/imdbspy";
import { SCALE_CRITERIA } from "@/types/imdbspy";

import { CriterionSlider } from "@imdbspy/components/CriterionSlider";
import { Textarea } from "@imdbspy/components/Textarea";
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

const SCALE_SEGMENTS: Segment<ScaleType>[] = [
  { value: "fun", label: "Fun" },
  { value: "grit", label: "Grit" },
  { value: "comfort", label: "Comfort" },
];

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
  // Kept apart from `error`: the save confirmation used to reuse the error
  // slot, so a success would have rendered in destructive red.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setScaleType(item.scale_type ?? "fun");
    setRatings(buildInitialRatings(item));
    setReviewText(item.user_review ?? "");
    setSeasonsSeen(item.seasons_seen ?? 0);
    setError(null);
    setNotice(null);
  }, [item]);

  const criteria = SCALE_CRITERIA[scaleType];

  const handleSubmit = () => {
    if (!item) return;
    setError(null);
    setNotice(null);

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
          setError(null);
          if (updated.user_rating !== null) {
            setNotice(`Saved. Your rating: ${updated.user_rating.toFixed(1)} / 10`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Review: {item.title}</DialogTitle>
          <DialogDescription>
            Rate this title and write your thoughts. The 0–10 score is derived
            from these criteria and the weights for the chosen scale.
          </DialogDescription>
        </DialogHeader>

        {/* Seven sliders plus a textarea outgrow a phone in landscape; the body
            scrolls so Save never leaves the screen. */}
        <DialogBody className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none text-foreground">
              Rating scale
            </p>
            <SegmentedControl
              segments={SCALE_SEGMENTS}
              value={scaleType}
              onValueChange={setScaleType}
              label="Rating scale"
              className="flex w-full"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none text-foreground">
              Criteria (0–5)
            </legend>
            <div className="flex flex-col gap-1 pt-1">
              {criteria.map((criterion) => {
                const key = CRITERION_TO_KEY[criterion];
                if (!key) return null;
                return (
                  <CriterionSlider
                    key={criterion}
                    label={criterion}
                    value={ratings[key]}
                    disabled={updateReview.isPending}
                    onChange={(value) =>
                      setRatings((prev) => ({ ...prev, [key]: value }))
                    }
                  />
                );
              })}
            </div>
          </fieldset>

          {item.kind === "tv" && item.seasons !== null ? (
            <Field label={`Seasons seen (0–${item.seasons})`}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={item.seasons}
                value={seasonsSeen}
                onChange={(e) =>
                  setSeasonsSeen(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="w-28"
              />
            </Field>
          ) : null}

          <Field label="Your review" hint="Optional.">
            <Textarea
              rows={4}
              className="min-h-20"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write your thoughts…"
              disabled={updateReview.isPending}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-foreground"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="rounded-[var(--radius-md)] border border-[hsl(var(--category-mint)/0.5)] bg-[hsl(var(--category-mint)/0.16)] px-3 py-2 text-sm font-medium text-foreground"
            >
              {notice}
            </p>
          ) : null}

          {item.user_rating !== null ? (
            <p className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-3 text-base font-extrabold tabular-nums text-primary-emphasis">
              Current rating: {item.user_rating.toFixed(1)} / 10
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateReview.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateReview.isPending}>
            {updateReview.isPending ? "Saving…" : "Save review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
