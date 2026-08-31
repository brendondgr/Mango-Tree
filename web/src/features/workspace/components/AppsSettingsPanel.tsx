import { useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AppToggleGrid } from "@/features/workspace/apps/AppToggleGrid";
import { SettingsSection } from "@/features/workspace/components/WorkspaceSettingsDialog";

/** Stable identity: a fresh [] literal in the selector re-renders forever. */
const NO_APPS: string[] = [];

/**
 * Settings → Apps. Enable or disable workspace apps at any time. Changes save
 * immediately; disabling an app also closes its open tab.
 */
export function AppsSettingsPanel() {
  const enabled = useAuthStore((s) => s.user?.preferences.enabled_apps ?? NO_APPS);
  const setPreferences = useAuthStore((s) => s.setPreferences);
  const closeAppTab = useWorkspaceStore((s) => s.closeAppTab);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, isOn: boolean) {
    const next = isOn ? [...new Set([...enabled, id])] : enabled.filter((x) => x !== id);
    setSaving(true);
    setError(null);
    try {
      await setPreferences({ enabled_apps: next });
      if (!isOn) closeAppTab(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update apps.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title="Enabled apps"
      description="Turn apps on or off. The chat window is always available."
      action={
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? "Saving…" : `${enabled.length} enabled`}
        </span>
      }
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <AppToggleGrid selected={enabled} onToggle={toggle} />
    </SettingsSection>
  );
}
