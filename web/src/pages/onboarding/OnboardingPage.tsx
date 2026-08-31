import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import mangoColorLogo from "@/assets/logos/mango-color.svg";
import { Button } from "@/components/ui/button";
import {
  getWorkspaceApp,
  WORKSPACE_APPS,
  type WorkspaceApp,
} from "@/features/workspace/apps/appRegistry";
import { cn } from "@/lib/utils";

const STEPS = ["welcome", "apps", "confirm"] as const;

const GROUP_DEFS: { title: string; ids: string[] }[] = [
  { title: "Personal", ids: ["calendar", "timekeeper", "exercise", "recipes"] },
  {
    title: "Work & media",
    ids: ["mailbox", "projectmanager", "mediaviewer", "imdbspy"],
  },
];

/**
 * Registry order does not match the two onboarding groups, so each group names
 * its apps explicitly. Anything added to the registry later and not named here
 * still appears — appended to the last group — rather than silently vanishing
 * from the only screen that offers to enable it.
 */
const APP_GROUPS: { title: string; apps: WorkspaceApp[] }[] = (() => {
  const named = new Set(GROUP_DEFS.flatMap((group) => group.ids));
  const unnamed = WORKSPACE_APPS.filter((app) => !named.has(app.id));
  return GROUP_DEFS.map((group, index) => ({
    title: group.title,
    apps: [
      ...group.ids
        .map((id) => getWorkspaceApp(id))
        .filter((app): app is WorkspaceApp => Boolean(app)),
      ...(index === GROUP_DEFS.length - 1 ? unnamed : []),
    ],
  }));
})();

const ORDERED_APPS = APP_GROUPS.flatMap((group) => group.apps);

/** "a", "a and b", "a, b and c" — the confirm line reads as a sentence. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * First-login screen, paced over three steps so the eight app choices do not
 * arrive as one undifferentiated wall. The owner picks which apps appear in
 * their workspace; selections can be changed later under Settings → Apps.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setPreferences = useAuthStore((s) => s.setPreferences);

  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const step = STEPS[stepIndex];

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

  // A step swap replaces the whole body, so anything focused inside the old
  // step is destroyed; without this a keyboard or screen-reader user lands
  // back on <body> with no idea what changed. Skipped on first paint, where
  // the natural reading order already starts at the heading.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

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

  function advance() {
    if (step === "confirm") {
      void finish();
    } else {
      setStepIndex((n) => n + 1);
    }
  }

  const selectedApps = ORDERED_APPS.filter((app) => selected.includes(app.id));
  const primaryLabel =
    step !== "confirm" ? "Continue" : saving ? "Saving…" : "Enter workspace";

  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 app:pt-10">
        <div className="mb-8 flex items-center gap-3">
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <div className="flex flex-1 items-center gap-1.5" aria-hidden>
            {STEPS.map((id, index) => (
              <span
                key={id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= stepIndex ? "bg-primary" : "bg-surface-2",
                )}
              />
            ))}
          </div>
        </div>

        {/* The two short steps centre in the viewport; the app list stays
            top-aligned so the first cards are not pushed below the fold. */}
        <main
          className={cn(
            "flex flex-1 flex-col",
            step === "apps" ? "justify-start" : "justify-center pb-10",
          )}
        >
          {step === "welcome" ? (
            <div className="text-center">
              <img
                src={mangoColorLogo}
                alt=""
                aria-hidden
                data-enter
                className="mx-auto h-40 w-40 app:h-56 app:w-56"
              />
              <h1
                ref={headingRef}
                tabIndex={-1}
                data-enter
                style={{ "--i": 1 } as never}
                className="mt-2 text-2xl font-semibold tracking-tight"
              >
                Welcome to Mango Tree
              </h1>
              <p
                data-enter
                style={{ "--i": 2 } as never}
                className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground"
              >
                Mango Tree is a private workspace where a chat assistant sits
                beside the apps you actually use — mail, calendar, recipes,
                workouts and more. The next step is choosing which of those apps
                appear on screen, and nothing you pick here is permanent.
              </p>
            </div>
          ) : null}

          {step === "apps" ? (
            <div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight"
              >
                Choose your apps
              </h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                The chat window is always available. Everything else is up to
                you, and you can change this anytime under Settings → Apps.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {selected.length} of {ORDERED_APPS.length} apps selected
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelected(ORDERED_APPS.map((app) => app.id))}
                  >
                    Select all
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSelected([])}>
                    Select none
                  </Button>
                </div>
              </div>

              {APP_GROUPS.map((group, groupIndex) => {
                const headingId = `onboarding-group-${groupIndex}`;
                // Stagger runs continuously across both groups so the cards
                // cascade down the page rather than restarting mid-way.
                const offset = APP_GROUPS.slice(0, groupIndex).reduce(
                  (total, previous) => total + previous.apps.length,
                  0,
                );
                return (
                  <section key={group.title} aria-labelledby={headingId} className="mt-6">
                    <h2
                      id={headingId}
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.title}
                    </h2>
                    <ul className="mt-3 grid grid-cols-1 gap-3 app:grid-cols-2">
                      {group.apps.map((app, index) => (
                        <AppCard
                          key={app.id}
                          app={app}
                          index={offset + index}
                          isOn={selected.includes(app.id)}
                          onToggle={toggle}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="text-center">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight"
              >
                You are all set
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {selectedApps.length === 0
                  ? "Your workspace will open with just the chat window — add apps whenever you like under Settings → Apps."
                  : `Chat plus ${formatList(selectedApps.map((app) => app.label))} will appear in your workspace.`}
              </p>
              {selectedApps.length > 0 ? (
                <ul
                  className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2"
                  aria-hidden
                >
                  {selectedApps.map((app, index) => {
                    const Icon = app.icon;
                    return (
                      <li
                        key={app.id}
                        data-enter
                        style={{ "--i": index } as never}
                        className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-sm"
                      >
                        <Icon className="h-4 w-4 text-primary-emphasis" />
                        {app.label}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-6 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </main>

        {/* Sticky so Continue is reachable without scrolling past eight cards
            on a short viewport; the safe-area padding keeps it clear of the
            iOS home indicator. */}
        <div className="sticky bottom-0 z-[var(--z-header)] -mx-4 mt-8 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center gap-3 py-3">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStepIndex((n) => n - 1)}
                disabled={saving}
              >
                Back
              </Button>
            ) : null}
            <Button type="button" className="ml-auto" onClick={advance} disabled={saving}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppCard({
  app,
  index,
  isOn,
  onToggle,
}: {
  app: WorkspaceApp;
  index: number;
  isOn: boolean;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const Icon = app.icon;
  return (
    <li data-enter style={{ "--i": index } as never}>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => onToggle(app.id, !isOn)}
        className={cn(
          "flex h-full w-full items-start gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isOn
            ? "border-primary/60 bg-primary/5"
            : "border-border bg-card hover:border-primary hover:ring-1 hover:ring-inset hover:ring-primary",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
            isOn
              ? "border-primary/40 bg-primary/10 text-primary-emphasis"
              : "border-border bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{app.label}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {app.description}
          </span>
        </span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            isOn
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent",
          )}
          aria-hidden
        >
          {isOn ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
      </button>
    </li>
  );
}
