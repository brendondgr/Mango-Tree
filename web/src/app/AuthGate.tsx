import { Navigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuthStore } from "@/app/stores/authStore";

/** Splash shown while the initial session probe is in flight. */
function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  );
}

/**
 * Gates its children behind an authenticated session. On first mount it probes
 * the session; unauthenticated users are bounced to /login. The onboarding
 * redirect is layered on in the workspace phase.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    if (status === "unknown") {
      void checkSession();
    }
  }, [status, checkSession]);

  if (status === "unknown") {
    return <AuthSplash />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
}
