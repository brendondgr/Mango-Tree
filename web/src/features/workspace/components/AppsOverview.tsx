import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { useEnabledApps } from "@/features/workspace/apps/useEnabledApps";

/**
 * Default landing surface shown whenever no app tab is active. Lists the owner's
 * enabled apps as launcher cards; selecting one opens it in a workspace tab.
 */
export function AppsOverview() {
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const enabledApps = useEnabledApps();

  return (
    <section
      className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-background p-10 max-[820px]:p-6 max-[820px]:px-4"
      aria-live="polite"
    >
      <div className="w-full max-w-3xl">
        <header className="mb-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Apps
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an app in a tab, or message the agent to get started.
          </p>
        </header>

        {enabledApps.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No apps are enabled yet. Turn some on under Settings → Apps.
          </p>
        ) : null}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {enabledApps.map((app) => {
            const Icon = app.icon;
            return (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => openAppTab(app.id)}
                  className="group flex h-full w-full items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted text-muted-foreground transition-colors group-hover:border-accent-foreground/30 group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground group-hover:text-accent-foreground">
                      {app.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground group-hover:text-accent-foreground/80">
                      {app.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
