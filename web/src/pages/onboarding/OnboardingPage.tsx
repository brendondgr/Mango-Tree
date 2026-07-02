import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
import { AppToggleGrid } from "@/features/workspace/apps/AppToggleGrid";

/**
 * First-login screen. The owner picks which apps appear in their workspace so
 * they are not overwhelmed by ones they do not use. Selections can be changed
 * later under Settings → Apps.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setPreferences = useAuthStore((s) => s.setPreferences);

  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not signed in? Back to login. Already onboarded? Skip straight to chat.
  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login" });
    } else if (user?.preferences.onboarding_completed) {
      navigate({ to: "/chat" });
    }
  }, [status, user, navigate]);

  // Seed from current preferences (defaults to just Artifacts on first run).
  useEffect(() => {
    if (user) setSelected(user.preferences.enabled_apps);
  }, [user]);

  function toggle(id: string, enabled: boolean) {
    setSelected((prev) =>
      enabled ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await setPreferences({ enabled_apps: selected, onboarding_completed: true });
      navigate({ to: "/chat" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your choices.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            🥭
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Mango Tree</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Choose the apps you want in your workspace. The chat window is always
            available — everything else is up to you, and you can change this
            anytime under Settings → Apps.
          </p>
        </header>

        <AppToggleGrid selected={selected} onToggle={toggle} />

        {error ? (
          <p className="mt-4 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selected.length} app{selected.length === 1 ? "" : "s"} selected
          </p>
          <Button onClick={finish} disabled={saving}>
            {saving ? "Saving…" : "Continue to workspace"}
          </Button>
        </div>
      </div>
    </div>
  );
}
