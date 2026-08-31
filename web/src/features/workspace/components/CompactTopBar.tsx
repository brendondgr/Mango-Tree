import {
  isAppWorkspaceTab,
  isEphemeralWorkspaceTab,
  useWorkspaceStore,
  EPHEMERAL_ARTIFACT_TAB_LABEL,
} from "@/app/stores/workspaceStore";
import mangoLogo from "@/assets/logos/mango.svg";
import { getWorkspaceApp } from "@/features/workspace/apps/appRegistry";
import { WorkspaceOptionsMenu } from "@/features/workspace/components/WorkspaceOptionsMenu";
import { WORKSPACE_HOME_TAB } from "@/features/workspace/components/workspaceTabs";
import { useShellLayout } from "@/hooks/useShellLayout";

/**
 * The compact shell's only top chrome: what you are looking at, and settings.
 *
 * Navigation lives in the bottom bar where the thumb is, so this stays a
 * single slim row. Padded for the notch — paired with `viewport-fit=cover` in
 * index.html, which must be set for the safe-area variables to be non-zero.
 */
export function CompactTopBar() {
  const { compactView } = useShellLayout();
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);

  return (
    <header
      className="z-[var(--z-header)] flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 pt-[env(safe-area-inset-top,0px)]"
      style={{ minHeight: "var(--header-h)" }}
    >
      <span
        role="img"
        aria-label="Mango Tree"
        className="h-6 w-6 shrink-0"
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

      {/* The page's only h1, naming whatever is on screen. Six of eight app
          surfaces previously rendered no h1 at all. */}
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
        {compactView === "chat"
          ? "Chat"
          : activeSurfaceLabel(activeWorkspaceTab, Boolean(ephemeralTab))}
      </h1>

      <WorkspaceOptionsMenu className="shrink-0" />
    </header>
  );
}

export function activeSurfaceLabel(
  activeWorkspaceTab: string,
  hasEphemeralTab: boolean,
): string {
  if (isAppWorkspaceTab(activeWorkspaceTab)) {
    const app = getWorkspaceApp(activeWorkspaceTab.slice("app:".length));
    if (app) return app.label;
  }
  if (isEphemeralWorkspaceTab(activeWorkspaceTab) && hasEphemeralTab) {
    return EPHEMERAL_ARTIFACT_TAB_LABEL;
  }
  return WORKSPACE_HOME_TAB.label;
}
