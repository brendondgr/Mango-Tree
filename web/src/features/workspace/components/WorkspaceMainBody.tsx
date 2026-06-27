import {
  appIdFromTab,
  ephemeralTabValue,
  isAppWorkspaceTab,
  isEphemeralWorkspaceTab,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { getWorkspaceApp } from "@/features/workspace/apps/appRegistry";
import { AppsOverview } from "@/features/workspace/components/AppsOverview";
import { useOAuthReturn } from "@mailbox/hooks/useMailbox";
import { MediaViewerShell } from "@media-viewer/components/MediaViewerShell";

export function WorkspaceMainBody() {
  useOAuthReturn();
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

  if (isAppWorkspaceTab(activeWorkspaceTab)) {
    const app = getWorkspaceApp(appIdFromTab(activeWorkspaceTab));
    if (app) {
      const Body = app.Component;
      return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Body />
        </div>
      );
    }
  }

  return <AppsOverview />;
}
