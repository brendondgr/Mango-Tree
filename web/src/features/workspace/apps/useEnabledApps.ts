import { useAuthStore } from "@/app/stores/authStore";

import { WORKSPACE_APPS, type WorkspaceApp } from "./appRegistry";

/** The app ids the signed-in owner has enabled (empty when signed out). */
export function useEnabledAppIds(): string[] {
  return useAuthStore((s) => s.user?.preferences.enabled_apps ?? []);
}

/** Registry entries filtered down to the owner's enabled apps, in registry order. */
export function useEnabledApps(): WorkspaceApp[] {
  const enabled = useEnabledAppIds();
  return WORKSPACE_APPS.filter((app) => enabled.includes(app.id));
}
