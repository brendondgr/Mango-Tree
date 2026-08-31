import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingWeights, ScaleType } from "@/types/imdbspy";
import { SCALE_CRITERIA } from "@/types/imdbspy";

import { CriterionSlider } from "@imdbspy/components/CriterionSlider";
import { useUpdateWeights, useWeights } from "@imdbspy/hooks/useImdbspy";

interface WeightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WeightKey =
  | "entertaining_weight"
  | "momentum_weight"
  | "characters_weight"
  | "rewatchability_weight"
  | "immersive_weight"
  | "stakes_weight"
  | "heart_weight";

const CRITERION_TO_WEIGHT: Record<string, WeightKey> = {
  entertaining: "entertaining_weight",
  momentum: "momentum_weight",
  characters: "characters_weight",
  rewatchability: "rewatchability_weight",
  immersive: "immersive_weight",
  stakes: "stakes_weight",
  heart: "heart_weight",
};

const SCALE_LABELS: Record<ScaleType, string> = {
  fun: "Fun",
  grit: "Grit",
  comfort: "Comfort",
};

const SCALES: ScaleType[] = ["fun", "grit", "comfort"];

type LocalWeights = Record<ScaleType, Record<WeightKey, number>>;

function defaultLocalWeights(): LocalWeights {
  return {
    fun: {
      entertaining_weight: 1,
      momentum_weight: 1,
      characters_weight: 1,
      rewatchability_weight: 1,
      immersive_weight: 0,
      stakes_weight: 0,
      heart_weight: 0,
    },
    grit: {
      entertaining_weight: 0,
      momentum_weight: 0,
      characters_weight: 1,
      rewatchability_weight: 1,
      immersive_weight: 1,
      stakes_weight: 1,
      heart_weight: 0,
    },
    comfort: {
      entertaining_weight: 1,
      momentum_weight: 0,
      characters_weight: 1,
      rewatchability_weight: 1,
      immersive_weight: 0,
      stakes_weight: 0,
      heart_weight: 1,
    },
  };
}

function weightsToLocal(data: RatingWeights[]): LocalWeights {
  const local = defaultLocalWeights();
  for (const w of data) {
    const scale = w.scale_type;
    local[scale] = {
      entertaining_weight: w.entertaining_weight,
      momentum_weight: w.momentum_weight,
      characters_weight: w.characters_weight,
      rewatchability_weight: w.rewatchability_weight,
      immersive_weight: w.immersive_weight,
      stakes_weight: w.stakes_weight,
      heart_weight: w.heart_weight,
    };
  }
  return local;
}

/** Three scales, four sliders each — the shape the loaded form settles into. */
function WeightsSkeleton() {
  return (
    <div className="space-y-5">
      {SCALES.map((scale) => (
        <div key={scale} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-1 p-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-28 shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WeightsDialog({ open, onOpenChange }: WeightsDialogProps) {
  const {
    data: weightsData,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useWeights();
  const updateWeights = useUpdateWeights();

  // `null` until real weights arrive. Seeding this with defaultLocalWeights()
  // was a data-loss path: while the query was in flight (or after it failed)
  // the sliders showed hardcoded defaults that looked exactly like saved
  // values, and Save wrote them over the stored ones — silently recomputing
  // every title's rating, since useUpdateWeights invalidates the media query.
  const [local, setLocal] = useState<LocalWeights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocal(weightsData ? weightsToLocal(weightsData) : null);
    setError(null);
  }, [open, weightsData]);

  // A failed refetch leaves the last-good data in place, so gate on the query
  // state too rather than on `local` alone.
  const ready = !isError && local !== null;

  const handleChange = (scale: ScaleType, key: WeightKey, value: number) => {
    setLocal((prev) =>
      prev
        ? {
            ...prev,
            [scale]: { ...prev[scale], [key]: value },
          }
        : prev,
    );
  };

  const handleSave = () => {
    if (!local) return;
    setError(null);
    const payload = SCALES.map((scale) => ({
      scale_type: scale,
      ...local[scale],
    }));
    updateWeights.mutate(payload, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => setError((err as Error).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rating weights</DialogTitle>
          <DialogDescription>
            Adjust how each criterion contributes to the final 0–10 score.
          </DialogDescription>
        </DialogHeader>

        {/* Replaces a hand-rolled `max-h-[60vh] overflow-y-auto`, which scrolled
            the header and the Save button out of reach along with the content. */}
        <DialogBody>
          {/* `local === null` folds the frame between open and the seeding
              effect into the loading state; AsyncBoundary gives the error
              branch precedence over it. */}
          <AsyncBoundary
            loading={isLoading || local === null}
            error={isError ? loadError : undefined}
            onRetry={() => void refetch()}
            label="rating weights"
            skeleton={<WeightsSkeleton />}
            className="space-y-5"
          >
            {local ? (
              <>
                {SCALES.map((scale) => (
                  <fieldset key={scale} className="space-y-2">
                    <legend className="text-sm font-semibold text-foreground">
                      {SCALE_LABELS[scale]}
                    </legend>
                    <div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-border bg-surface-1 p-2">
                      {SCALE_CRITERIA[scale].map((criterion) => {
                        const key = CRITERION_TO_WEIGHT[criterion];
                        if (!key) return null;
                        return (
                          <CriterionSlider
                            key={criterion}
                            label={criterion}
                            value={local[scale][key]}
                            disabled={updateWeights.isPending}
                            onChange={(value) => handleChange(scale, key, value)}
                          />
                        );
                      })}
                    </div>
                  </fieldset>
                ))}

                {error ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-foreground"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}
          </AsyncBoundary>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateWeights.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            // Never savable until real weights are on screen.
            disabled={updateWeights.isPending || !ready}
          >
            {updateWeights.isPending ? "Saving…" : "Save weights"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
