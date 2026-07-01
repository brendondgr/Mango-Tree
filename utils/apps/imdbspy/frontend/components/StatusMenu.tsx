import { CheckCircle, ChevronDown, Circle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MediaItem, MediaStatus } from "@/types/imdbspy";

import { useSetStatus } from "@imdbspy/hooks/useImdbspy";

interface StatusMenuProps {
  item: MediaItem;
}

const STATUS_OPTIONS: Array<{ value: MediaStatus; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "not_seen", label: "Not Seen", icon: Circle },
  { value: "seen", label: "Seen", icon: CheckCircle },
  { value: "abandoned", label: "Abandoned", icon: XCircle },
];

const STATUS_LABELS: Record<MediaStatus, string> = {
  not_seen: "Not Seen",
  seen: "Seen",
  abandoned: "Abandoned",
};

export function StatusMenu({ item }: StatusMenuProps) {
  const setStatus = useSetStatus();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={setStatus.isPending}
        >
          <span
            className="imdbspy-status-badge"
            data-status={item.status}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="imdbspy-app">
        {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            className="gap-2 text-xs"
            onSelect={() => {
              if (value !== item.status) {
                setStatus.mutate({ id: item.id, status: value });
              }
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
