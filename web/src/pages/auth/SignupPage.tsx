import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApiError, getRegistrationStatus } from "@/services/authClient";

import { AuthCard } from "./AuthCard";

export function SignupPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const signup = useAuthStore((s) => s.signup);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      navigate({ to: "/chat" });
    }
  }, [status, navigate]);

  // Single-owner platform: signup is only available before the owner exists.
  useEffect(() => {
    getRegistrationStatus()
      .then((s) => setRegistrationOpen(s.registration_open))
      .catch(() => setRegistrationOpen(false));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await signup(username.trim(), password);
      // The route guard sends brand-new owners into onboarding.
      navigate({ to: "/chat" });
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "validation_error") {
        const messages = (err.details as { errors?: string[] } | null)?.errors;
        setError(messages?.join(" ") ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "Sign up failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (registrationOpen === false) {
    return (
      <AuthCard
        title="Registration closed"
        subtitle="An owner account already exists for this instance."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          This platform supports a single owner account, which has already been created.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create the owner account"
      subtitle="This is a one-time setup for the person who administers this instance."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            At least 10 characters, not entirely numeric, and not a common password.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
