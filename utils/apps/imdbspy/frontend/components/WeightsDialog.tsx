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
import type { RatingWeights, ScaleType } from "@/types/imdbspy";
import { SCALE_CRITERIA } from "@/types/imdbspy";

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

export function WeightsDialog({ open, onOpenChange }: WeightsDialogProps) {
  const { data: weightsData } = useWeights();
  const updateWeights = useUpdateWeights();

  const [local, setLocal] = useState<LocalWeights>(defaultLocalWeights());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (weightsData) {
      setLocal(weightsToLocal(weightsData));
    } else {
      setLocal(defaultLocalWeights());
    }
    setError(null);
  }, [open, weightsData]);

  const handleChange = (scale: ScaleType, key: WeightKey, value: number) => {
    setLocal((prev) => ({
      ...prev,
      [scale]: { ...prev[scale], [key]: value },
    }));
  };

  const handleSave = () => {
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
      <DialogContent className="imdbspy-app max-w-lg">
        <DialogHeader>
          <DialogTitle>Rating Weights</DialogTitle>
          <DialogDescription>
            Adjust how each criterion contributes to the final 0–10 score.
          </DialogDescription>
        </DialogHeader>

        <div className="imdbspy-dialog-body max-h-[60vh] overflow-y-auto">
          {SCALES.map((scale) => (
            <div key={scale} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">{SCALE_LABELS[scale]}</p>
              {SCALE_CRITERIA[scale].map((criterion) => {
                const key = CRITERION_TO_WEIGHT[criterion];
                if (!key) return null;
                return (
                  <div key={criterion} className="imdbspy-slider-row">
                    <Label className="imdbspy-slider-label">{criterion}</Label>
                    <input
                      type="range"
                      className="imdbspy-slider"
                      min={0}
                      max={5}
                      step={0.5}
                      value={local[scale][key]}
                      onChange={(e) =>
                        handleChange(scale, key, parseFloat(e.target.value))
                      }
                    />
                    <span className="imdbspy-slider-value">{local[scale][key]}</span>
                  </div>
                );
              })}
              <div className="h-px bg-border my-1" />
            </div>
          ))}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateWeights.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateWeights.isPending}>
            {updateWeights.isPending ? "Saving…" : "Save Weights"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
