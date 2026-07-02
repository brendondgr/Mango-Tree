import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApiError, getRegistrationStatus } from "@/services/authClient";

import { AuthCard } from "./AuthCard";

export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (status === "authenticated") {
      navigate({ to: "/chat" });
    }
  }, [status, navigate]);

  // Surface first-run setup when no owner account exists yet.
  useEffect(() => {
    getRegistrationStatus()
      .then((s) => setRegistrationOpen(s.registration_open))
      .catch(() => setRegistrationOpen(false));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate({ to: "/chat" });
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        setError("Too many failed attempts. Please wait a few minutes and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Enter your credentials to access the workspace."
      footer={
        registrationOpen ? (
          <>
            No account yet?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create the owner account
            </Link>
          </>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
