import { FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  EPHEMERAL_ARTIFACT_TAB_LABEL,
  appTabValue,
  ephemeralTabValue,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import {
  getWorkspaceApp,
  type WorkspaceApp,
} from "@/features/workspace/apps/appRegistry";
import { WorkspaceOptionsMenu } from "@/features/workspace/components/WorkspaceOptionsMenu";
import { activeSurfaceLabel } from "@/features/workspace/components/CompactTopBar";
import { WORKSPACE_HOME_TAB } from "@/features/workspace/components/workspaceTabs";
import { cn } from "@/lib/utils";

/**
 * Desktop tab strip.
 *
 * The strip previously had no overflow strategy at all: with four or more apps
 * open the last tabs were painted past the panel's right edge and clipped by
 * `main`'s `overflow-hidden`, so they could never be clicked — and arrow-key
 * navigation moved focus onto an element that was not on screen. It now
 * scrolls, and keeps the active tab scrolled into view.
 *
 * The compact shell renders `CompactTopBar` and `BottomNav` instead.
 */
export function WorkspaceHeader() {
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const openAppIds = useWorkspaceStore((s) => s.openAppIds);
  const closeAppTab = useWorkspaceStore((s) => s.closeAppTab);
  const setActiveWorkspaceTab = useWorkspaceStore((s) => s.setActiveWorkspaceTab);

  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when it is opened from the rail rather than
  // clicked in the strip.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeWorkspaceTab, openAppIds.length]);

  const openApps = openAppIds
    .map((id) => getWorkspaceApp(id))
    .filter((app): app is WorkspaceApp => Boolean(app));

  const HomeIcon = WORKSPACE_HOME_TAB.icon;

  return (
    <header
      className="relative z-[var(--z-header)] flex shrink-0 items-stretch justify-between gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-sm"
      style={{ height: "var(--header-h)" }}
    >
      {/* The page's only h1, naming the surface on screen. */}
      <h1 className="sr-only">
        {activeSurfaceLabel(activeWorkspaceTab, Boolean(ephemeralTab))}
      </h1>

      {/*
        These are navigation controls that switch the main region, not tabs
        inside a widget. Modelling them as a Radix Tabs strip produced an
        `aria-controls` pointing at a tab panel that does not exist (there is no
        TabsContent — the body is rendered separately), and it forced the close
        control to be a button nested inside the trigger button, which axe
        flagged on 36 nodes. A nav of buttons with aria-current is both honest
        and valid.
      */}
      <nav
        aria-label="Open apps"
        className="flex min-w-0 flex-1 self-stretch"
      >
        <div
          ref={listRef}
          className="flex h-full w-full items-end justify-start gap-0 overflow-x-auto overflow-y-hidden scrollbar-none"
        >
          <TabButton
            active={activeWorkspaceTab === WORKSPACE_HOME_TAB.id}
            onSelect={() => setActiveWorkspaceTab(WORKSPACE_HOME_TAB.id)}
            icon={<HomeIcon className="h-4 w-4 shrink-0" aria-hidden />}
            label={WORKSPACE_HOME_TAB.label}
          />

          {openApps.map((app) => {
            const Icon = app.icon;
            const value = appTabValue(app.id);
            return (
              <TabButton
                key={app.id}
                active={activeWorkspaceTab === value}
                onSelect={() => setActiveWorkspaceTab(value)}
                icon={<Icon className="h-4 w-4 shrink-0" aria-hidden />}
                label={app.label}
                onClose={() => closeAppTab(app.id)}
                closeLabel={`Close ${app.label} tab`}
              />
            );
          })}

          {ephemeralTab && (
            <TabButton
              active={activeWorkspaceTab === ephemeralTabValue(ephemeralTab.id)}
              onSelect={() =>
                setActiveWorkspaceTab(ephemeralTabValue(ephemeralTab.id))
              }
              icon={<FileText className="h-4 w-4 shrink-0" aria-hidden />}
              label={ephemeralTab.tabLabel || EPHEMERAL_ARTIFACT_TAB_LABEL}
              italic
            />
          )}
        </div>
      </nav>

      <WorkspaceOptionsMenu className="shrink-0 self-center" />
    </header>
  );
}

/**
 * One tab in the strip: a select button, with an optional sibling close
 * button. Siblings rather than nested, so neither control swallows the other.
 */
function TabButton({
  active,
  onSelect,
  icon,
  label,
  onClose,
  closeLabel,
  italic = false,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  onClose?: () => void;
  closeLabel?: string;
  italic?: boolean;
}) {
  return (
    <span
      className={cn(
        "group relative -mb-px flex shrink-0 items-stretch rounded-t-[var(--radius-sm)]",
        "border border-transparent border-b-0",
        active
          ? "border-border border-b-background bg-background"
          : "hover:bg-muted/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          italic && "italic",
          onClose && "pr-1",
        )}
      >
        {icon}
        <span className="max-w-[10rem] truncate">{label}</span>
      </button>

      {onClose && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className={cn(
            "mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center self-center",
            "rounded-[var(--radius-sm)] text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
