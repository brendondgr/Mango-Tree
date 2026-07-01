import {
  CalendarDays,
  ChefHat,
  Clock,
  Dumbbell,
  Film,
  FolderKanban,
  FolderOpen,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { CalendarWorkspace } from "@calendar/pages/CalendarWorkspace";
import { ExerciseWorkspace } from "@exercise/pages/ExerciseWorkspace";
import { ImdbspyWorkspace } from "@imdbspy/pages/ImdbspyWorkspace";
import { MailboxWorkspace } from "@mailbox/pages/MailboxWorkspace";
import { ArtifactsWorkspace } from "@media-viewer/pages/ArtifactsWorkspace";
import { ProjectManagerWorkspace } from "@projectmanager/pages/ProjectManagerWorkspace";
import { RecipesWorkspace } from "@recipes/pages/RecipesWorkspace";
import { TimekeeperWorkspace } from "@timekeeper/pages/TimekeeperWorkspace";

/**
 * Single source of truth for the apps that can be opened as workspace tabs.
 *
 * Adding an entry here automatically wires the app into:
 *   - the Apps overview launcher (`AppsOverview`),
 *   - the workspace header tab strip (open/close + active state),
 *   - the left nav-rail quick-launch icons (`ChatNavRail`),
 *   - and main-body routing (`WorkspaceMainBody`) via `Component`.
 *
 * The workspace tab value for an app is `app:${id}` (see `appTabValue`).
 */
export interface WorkspaceApp {
  /** Stable id. The tab value is `app:${id}`; keep it unique and URL-safe. */
  id: string;
  /** Short label shown on the tab and the launcher card. */
  label: string;
  /** One-line description shown on the Apps overview launcher card. */
  description: string;
  /** Lucide icon used on the tab, launcher card, and nav-rail button. */
  icon: LucideIcon;
  /** Component rendered in the main workspace body when this tab is active. */
  Component: ComponentType;
}

export const WORKSPACE_APPS: WorkspaceApp[] = [
  {
    id: "mailbox",
    label: "Mailbox",
    description: "Read and triage email across your connected accounts.",
    icon: Mail,
    Component: MailboxWorkspace,
  },
  {
    id: "exercise",
    label: "Exercise",
    description: "Plan workouts and routines, and track equipment and history.",
    icon: Dumbbell,
    Component: ExerciseWorkspace,
  },
  {
    id: "projectmanager",
    label: "Projects",
    description: "Organize projects and tasks on a master-detail board.",
    icon: FolderKanban,
    Component: ProjectManagerWorkspace,
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Plan weekly schedules and a dated calendar of merged events.",
    icon: CalendarDays,
    Component: CalendarWorkspace,
  },
  {
    id: "imdbspy",
    label: "IMDbSpy",
    description: "Track movies and shows to watch, mark them seen, and rate them.",
    icon: Film,
    Component: ImdbspyWorkspace,
  },
  {
    id: "recipes",
    label: "Recipes",
    description: "Browse recipes, match them to your pantry, and add your own.",
    icon: ChefHat,
    Component: RecipesWorkspace,
  },
  {
    id: "mediaviewer",
    label: "Artifacts",
    description: "Browse, preview, and manage files and generated outputs.",
    icon: FolderOpen,
    Component: ArtifactsWorkspace,
  },
  {
    id: "timekeeper",
    label: "Time Keeper",
    description: "Track time in 5-minute blocks and review daily statistics.",
    icon: Clock,
    Component: TimekeeperWorkspace,
  },
];

export function getWorkspaceApp(id: string): WorkspaceApp | undefined {
  return WORKSPACE_APPS.find((app) => app.id === id);
}
