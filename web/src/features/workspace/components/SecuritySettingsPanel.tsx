import { useCallback, useEffect, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
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
    try {
      await unlockIp(ip);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the address.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Account */}
      <section className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Account</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{username}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </section>

      {/* Active lockouts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Blocked addresses</h3>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {lockouts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No addresses are currently locked out.</p>
        ) : (
          <ul className="space-y-2">
            {lockouts.map((lock) => (
              <li
                key={lock.ip_address}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-card px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-mono">{lock.ip_address}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {lock.failed} failed · unlocks in {Math.ceil(lock.retry_after_seconds / 60)} min
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => void onUnlock(lock.ip_address)}>
                  Unlock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Attempt log */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Recent login attempts</h3>
        {error ? (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {attempts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No login attempts recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">IP address</th>
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
                    <td className="px-3 py-2 font-mono">{attempt.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
