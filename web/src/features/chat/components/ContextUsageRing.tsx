import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ContextUsageRingProps {
  usedTokens: number | null;
  maxTokens: number | null;
  percent: number | null;
  isLoading?: boolean;
  isEstimated?: boolean;
  label: string;
  className?: string;
}

const SIZE = 22;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTokenCount(value: number): string {
  return value.toLocaleString();
}

function ringColor(percent: number | null): string {
  if (percent == null) return "text-muted-foreground";
  if (percent >= 90) return "text-destructive";
  if (percent >= 75) return "text-amber-500";
  return "text-primary";
}

export function ContextUsageRing({
  usedTokens,
  maxTokens,
  percent,
  isLoading = false,
  isEstimated = false,
  label,
  className,
}: ContextUsageRingProps) {
  const progress =
    percent != null ? Math.min(100, Math.max(0, percent)) / 100 : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const colorClass = ringColor(percent);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
          aria-label={label}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxTokens ?? undefined}
          aria-valuenow={usedTokens ?? undefined}
          aria-busy={isLoading}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className={cn("rotate-[-90deg]", colorClass)}
            aria-hidden
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="opacity-20"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className={cn(
                "transition-[stroke-dashoffset] duration-300",
                isLoading && "opacity-60",
              )}
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
        {usedTokens != null && maxTokens != null && percent != null && (
          <p className="text-muted-foreground">
            {formatTokenCount(usedTokens)} / {formatTokenCount(maxTokens)} tokens
            ({Math.round(percent)}%)
            {isEstimated ? " · estimated" : ""}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
