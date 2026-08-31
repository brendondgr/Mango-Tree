import { MessageSquare } from "lucide-react";

import { appTabValue, useWorkspaceStore } from "@/app/stores/workspaceStore";
import mangoLogo from "@/assets/logos/mango.svg";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEnabledApps } from "@/features/workspace/apps/useEnabledApps";
import { useShellLayout } from "@/hooks/useShellLayout";
import { cn } from "@/lib/utils";

/**
 * Desktop quick-launch rail.
 *
 * Desktop only — the compact shell uses `BottomNav` instead, where the same
 * destinations get real labels and thumb-reachable targets. Icons here carry
 * tooltips as well as accessible names, so the rail is legible without hover
 * guesswork.
 */
export function ChatNavRail() {
  const { isCompact, chatHidden, showChat } = useShellLayout();
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const enabledApps = useEnabledApps();

  if (isCompact) return null;

  return (
    <nav
      aria-label="Apps"
      className="z-[var(--z-rail)] flex shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3"
      style={{ width: "var(--rail-w)" }}
    >
      <span
        role="img"
        aria-label="Mango Tree"
        className="mb-1 h-7 w-7 shrink-0"
        style={{
          backgroundColor: "var(--mango-logo-color)",
          WebkitMaskImage: `url(${mangoLogo})`,
          maskImage: `url(${mangoLogo})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />

      <RailButton
        label="Chat"
        active={!chatHidden}
        onClick={showChat}
        icon={<MessageSquare className="h-5 w-5" />}
      />

      {enabledApps.map((app) => {
        const Icon = app.icon;
        const active = activeWorkspaceTab === appTabValue(app.id);
        return (
          <RailButton
            key={app.id}
            label={app.label}
            active={active}
            current={active}
            onClick={() => openAppTab(app.id)}
            icon={<Icon className="h-5 w-5" />}
          />
        );
      })}
    </nav>
  );
}

function RailButton({
  label,
  icon,
  active,
  current,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  current?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "h-10 w-10 rounded-[var(--radius-md)]",
            !active &&
              "hover:bg-transparent hover:text-primary hover:ring-1 hover:ring-inset hover:ring-primary/40 hover:[&_svg]:text-primary",
            active && "bg-secondary text-foreground",
          )}
          aria-label={label}
          aria-current={current ? "page" : undefined}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
