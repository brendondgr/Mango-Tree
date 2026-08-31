import { AlertCircle, History, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/features/workspace/components/WorkspaceSettingsDialog";
import {
  getSecurityAttempts,
  getSecurityLockouts,
  unlockIp,
  type LoginAttempt,
  type Lockout,
} from "@/services/authClient";

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function LockoutSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-md)]" />
      ))}
    </div>
  );
}

/** Matches the loaded table: a header band above five rows of four cells. */
function AttemptsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
      <Skeleton className="h-9 w-full rounded-none" />
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-3 flex-[2]" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 flex-[1.5]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings → Security. Shows the account, active IP lockouts (with a manual
 * unlock), and the audit log of recent login attempts (time, outcome, IP).
 */
export function SecuritySettingsPanel({ active }: { active: boolean }) {
  const username = useAuthStore((s) => s.user?.username ?? "");
  const logout = useAuthStore((s) => s.logout);

  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed unlock must not be reported as a failed load: both tables are
  // driven by `error`, so writing an action failure into it replaced perfectly
  // good data with "Couldn't load…" and a Retry that had nothing to retry.
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([getSecurityAttempts(), getSecurityLockouts()]);
      setAttempts(a.attempts);
      setLockouts(l.lockouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load security data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  async function onUnlock(ip: string) {
    setActionError(null);
    try {
      await unlockIp(ip);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not unlock the address.",
      );
    }
  }

  return (
    <div className="grid gap-6">
      <SettingsSection
        className="rounded-[var(--radius-lg)] border border-border bg-card p-4"
        title="Account"
        description={
          <>
            Signed in as{" "}
            <span className="font-medium text-foreground">{username}</span>
          </>
        }
        action={
          <Button variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        }
      />

      <SettingsSection
        title="Blocked addresses"
        description="Addresses locked out after repeated failed sign-ins."
        action={
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      >
        {actionError && (
          <p
            role="alert"
            className="mb-3 flex items-start gap-1.5 rounded-[var(--radius-sm)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{actionError}</span>
          </p>
        )}
        <AsyncBoundary
          loading={loading}
          error={error}
          empty={lockouts.length === 0}
          onRetry={() => void load()}
          label="blocked addresses"
          skeleton={<LockoutSkeleton />}
          emptyIcon={ShieldCheck}
          emptyTitle="Nothing is blocked"
          emptyDescription="No addresses are currently locked out."
        >
          <ul className="grid gap-2">
            {lockouts.map((lock, index) => (
              <li
                key={lock.ip_address}
                data-enter
                style={{ "--i": index } as never}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-mono">{lock.ip_address}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {lock.failed} failed · unlocks in{" "}
                    {Math.ceil(lock.retry_after_seconds / 60)} min
                  </span>
                </span>
                <Button
                  variant="outline"
                  onClick={() => void onUnlock(lock.ip_address)}
                >
                  Unlock
                </Button>
              </li>
            ))}
          </ul>
        </AsyncBoundary>
      </SettingsSection>

      <SettingsSection
        title="Recent login attempts"
        description="Time, outcome, and origin of the most recent sign-in attempts."
      >
        <AsyncBoundary
          loading={loading}
          error={error}
          empty={attempts.length === 0}
          onRetry={() => void load()}
          label="login attempts"
          skeleton={<AttemptsSkeleton />}
          emptyIcon={History}
          emptyTitle="No login attempts yet"
          emptyDescription="Sign-in attempts are recorded here as they happen."
        >
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
            {/* The IP column is the point of an audit log, so the table gets a
                real horizontal scroller instead of being clipped by the panel. */}
            <div
              className="scroll-region"
              role="region"
              aria-label="Recent login attempts, scrollable"
              tabIndex={0}
            >
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Result
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Username
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      IP address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatTime(attempt.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            attempt.successful
                              ? "font-medium text-emerald-600 dark:text-emerald-400"
                              : "font-medium text-destructive"
                          }
                        >
                          {attempt.successful ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{attempt.username || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {attempt.ip_address ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AsyncBoundary>
      </SettingsSection>
    </div>
  );
}
