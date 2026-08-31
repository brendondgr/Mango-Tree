import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
import { Field, useFormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getRegistrationStatus } from "@/services/authClient";

import {
  AUTH_ENTER_FIRST_FIELD,
  AuthCard,
  FormAlert,
  PasswordField,
  authErrorField,
  authErrorMessage,
} from "./AuthCard";

/** Kept to one line at 360px so the form still clears the fold on a phone. */
const PASSWORD_RULES =
  "At least 10 characters, not entirely numeric, and not a common password.";

export function SignupPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const signup = useAuthStore((s) => s.signup);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [failures, setFailures] = useState(0);

  const {
    errors,
    formError,
    setFormError,
    setFieldError,
    clear,
    focusFirstError,
  } = useFormErrors<"username" | "password" | "confirm">();

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

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

  // Runs after the failing render has committed, so `aria-invalid` is already
  // in the DOM. The DOM query decides whether there is a field to move to at
  // all; a failure that belongs to no field focuses the alert instead.
  useEffect(() => {
    if (failures === 0) return;
    const form = formRef.current;
    if (form?.querySelector('[aria-invalid="true"]')) {
      focusFirstError(form);
    } else {
      alertRef.current?.focus();
    }
  }, [failures, focusFirstError]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    clear();

    const trimmed = username.trim();
    if (!trimmed) {
      // `required` rejects an empty box but accepts one holding only spaces.
      setFieldError("username", "Username is required.");
      setFailures((n) => n + 1);
      return;
    }
    if (password !== confirm) {
      setFieldError("confirm", "Passwords do not match.");
      setFailures((n) => n + 1);
      return;
    }

    setSubmitting(true);
    try {
      await signup(trimmed, password);
      // The route guard sends brand-new owners into onboarding.
      navigate({ to: "/chat" });
    } catch (err) {
      const message = authErrorMessage(err, "Sign up failed.");
      const field = authErrorField(err);
      if (field) setFieldError(field, message);
      else setFormError(message);
      setFailures((n) => n + 1);
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
          <Link
            to="/login"
            className="font-medium text-primary-emphasis hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          This platform supports a single owner account, which has already been
          created.
        </p>
      </AuthCard>
    );
  }

  return (
    // No subtitle here: three fields plus the password rules already fill a
    // 360x640 screen, and of the two lines competing for that space the rules
    // are the one that prevents an error.
    <AuthCard
      title="Create the owner account"
      footer={
        <Link
          to="/login"
          className="font-medium text-primary-emphasis hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <div data-enter style={{ "--i": AUTH_ENTER_FIRST_FIELD } as never}>
          <Field label="Username" error={errors.username} required>
            <Input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </Field>
        </div>

        <PasswordField
          label="Password"
          name="password"
          hint={PASSWORD_RULES}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          enterIndex={AUTH_ENTER_FIRST_FIELD + 1}
        />

        <PasswordField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          enterIndex={AUTH_ENTER_FIRST_FIELD + 2}
        />

        {formError ? (
          <FormAlert message={formError} alertRef={alertRef} />
        ) : null}

        <div data-enter style={{ "--i": AUTH_ENTER_FIRST_FIELD + 3 } as never}>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
