import { Check, CheckCircle, ChevronDown, Circle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaStatus } from "@/types/imdbspy";

import { STATUS_LABELS, StatusDot, statusTone } from "@imdbspy/components/MediaBadges";
import { useSetStatus } from "@imdbspy/hooks/useImdbspy";

interface StatusMenuProps {
  item: MediaItem;
}

const STATUS_OPTIONS: Array<{
  value: MediaStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "not_seen", label: "Not Seen", icon: Circle },
  { value: "seen", label: "Seen", icon: CheckCircle },
  { value: "abandoned", label: "Abandoned", icon: XCircle },
];

export function StatusMenu({ item }: StatusMenuProps) {
  const setStatus = useSetStatus();
  const tone = statusTone(item.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          style={tone.style}
          className={cn(
            "gap-1.5 px-2.5 text-[0.6875rem] font-bold uppercase tracking-wide",
            tone.className,
          )}
          disabled={setStatus.isPending}
          // The trigger IS the status, so it needs to announce both the current
          // value and what activating it does.
          aria-label={`Status: ${STATUS_LABELS[item.status]}. Change status for ${item.title}`}
        >
          <StatusDot status={item.status} />
          {STATUS_LABELS[item.status]}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => {
          const current = value === item.status;
          return (
            <DropdownMenuItem
              key={value}
              // The primitive's 32px row is fine for a mouse but under the
              // touch minimum on a compact viewport.
              className="min-h-11 gap-2 text-sm app:min-h-9"
              onSelect={() => {
                if (value !== item.status) {
                  setStatus.mutate({ id: item.id, status: value });
                }
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {current ? (
                <>
                  <Check className="h-4 w-4 shrink-0 text-primary-emphasis" aria-hidden />
                  <span className="sr-only">(current)</span>
                </>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
