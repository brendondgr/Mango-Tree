import {
  ephemeralTabValue,
  isEphemeralWorkspaceTab,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { getWorkspaceTab } from "@/features/workspace/components/workspaceTabs";
import { MediaViewerShell } from "@media-viewer/components/MediaViewerShell";

export function WorkspaceMainBody() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const activeWorkspaceTab = useWorkspaceStore((s) => s.activeWorkspaceTab);
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);

  const ephemeralActive =
    ephemeralTab &&
    isEphemeralWorkspaceTab(activeWorkspaceTab) &&
    activeWorkspaceTab === ephemeralTabValue(ephemeralTab.id);

  if (ephemeralActive && ephemeralTab.kind === "artifact") {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MediaViewerShell artifactId={ephemeralTab.artifactId} />
      </div>
    );
  }

  const pinnedTab = isEphemeralWorkspaceTab(activeWorkspaceTab)
    ? activeTab
    : activeWorkspaceTab;
  const tab = getWorkspaceTab(pinnedTab);
  const Icon = tab.icon;

  return (
    <section
      className="flex min-h-0 flex-1 items-center justify-center bg-background p-10 text-muted-foreground max-[820px]:items-start max-[820px]:p-6 max-[820px]:px-4"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashed border-border bg-card px-8 py-12 text-center max-[820px]:rounded-[var(--radius-md)] max-[820px]:px-5 max-[820px]:py-8">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-foreground">
          {tab.title}
        </h2>
        <p className="mx-auto max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
          {tab.body}
        </p>
      </div>
    </section>
  );
}
