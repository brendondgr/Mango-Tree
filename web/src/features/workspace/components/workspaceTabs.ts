import {
  Clock,
  FileText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceTabId = "overview" | "assets" | "history";

export interface WorkspaceTabMeta {
  id: WorkspaceTabId;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

export const WORKSPACE_TABS: WorkspaceTabMeta[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Workspace active",
    body: "Your digital canvas is ready. Select a tab or message the agent to begin.",
    icon: ShoppingBag,
  },
  {
    id: "assets",
    label: "Assets",
    title: "Assets",
    body: "Uploaded files and generated outputs will appear here.",
    icon: FileText,
  },
  {
    id: "history",
    label: "History",
    title: "History",
    body: "Past sessions and workspace activity will be listed here.",
    icon: Clock,
  },
];

export function getWorkspaceTab(id: WorkspaceTabId): WorkspaceTabMeta {
  return WORKSPACE_TABS.find((t) => t.id === id) ?? WORKSPACE_TABS[0];
}
