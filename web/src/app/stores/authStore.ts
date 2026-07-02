import { create } from "zustand";

import * as authClient from "@/services/authClient";
import type { AuthPreferences, AuthUser } from "@/services/authClient";

// "unknown" until the first session probe resolves; the gate shows a splash
// while unknown, redirects to /login while unauthenticated.
type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  checkPromise: Promise<void> | null;
  /** Probe the session once (idempotent) and cache the result. */
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setPreferences: (patch: Partial<AuthPreferences>) => Promise<AuthPreferences>;
  /** Called by the fetch interceptor when a gated request is rejected. */
  markUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "unknown",
  user: null,
  checkPromise: null,

  checkSession: () => {
    const existing = get().checkPromise;
    if (existing) return existing;

    const promise = (async () => {
      try {
        await authClient.ensureCsrf();
        const user = await authClient.getMe();
        set({ status: "authenticated", user });
      } catch {
        set({ status: "unauthenticated", user: null });
      } finally {
        set({ checkPromise: null });
      }
    })();

    set({ checkPromise: promise });
    return promise;
  },

  login: async (username, password) => {
    await authClient.ensureCsrf();
    const user = await authClient.login(username, password);
    set({ status: "authenticated", user });
  },

  signup: async (username, password) => {
    await authClient.ensureCsrf();
    const user = await authClient.signup(username, password);
    set({ status: "authenticated", user });
  },

  logout: async () => {
    try {
      await authClient.logout();
    } finally {
      set({ status: "unauthenticated", user: null });
    }
  },

  setPreferences: async (patch) => {
    const preferences = await authClient.updatePreferences(patch);
    const user = get().user;
    if (user) {
      set({ user: { ...user, preferences } });
    }
    return preferences;
  },

  markUnauthenticated: () => {
    if (get().status !== "unauthenticated") {
      set({ status: "unauthenticated", user: null });
    }
  },
}));
