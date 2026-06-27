import { LayoutGrid, type LucideIcon } from "lucide-react";

/**
 * The only pinned (non-closeable) workspace tab is the Apps home, which shows
 * the Apps overview launcher. Every other tab is an app opened from the
 * registry (see `apps/appRegistry`) or an ephemeral artifact viewer.
 */
export type WorkspaceTabId = "apps";

export interface WorkspaceTabMeta {
  id: WorkspaceTabId;
  label: string;
  icon: LucideIcon;
}

export const WORKSPACE_HOME_TAB: WorkspaceTabMeta = {
  id: "apps",
  label: "Apps",
  icon: LayoutGrid,
};
