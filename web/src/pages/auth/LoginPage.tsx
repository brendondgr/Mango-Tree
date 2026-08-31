import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/app/stores/authStore";
import { Button } from "@/components/ui/button";
import { Field, useFormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthApiError, getRegistrationStatus } from "@/services/authClient";

import {
  AUTH_ENTER_FIRST_FIELD,
  AuthCard,
  FormAlert,
  PasswordField,
  authErrorField,
  authErrorMessage,
} from "./AuthCard";

export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [failures, setFailures] = useState(0);

  const {
    errors,
    formError,
    setFormError,
    setFieldError,
    clear,
    focusFirstError,
  } = useFormErrors<"username" | "password">();

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

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

  // Runs after the failing render has committed, so `aria-invalid` is already
  // in the DOM. The DOM query decides whether there is a field to move to at
  // all; a failure that belongs to no field (a lockout) focuses the alert
  // instead, rather than leaving focus on a button the user just pressed.
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

    setSubmitting(true);
    try {
      await login(trimmed, password);
      navigate({ to: "/chat" });
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        setFormError(
          "Too many failed attempts. Please wait a few minutes and try again.",
        );
      } else {
        const message = authErrorMessage(err, "Login failed.");
        // A credentials rejection deliberately refuses to say which half was
        // wrong, so it attaches to the password — the field the user retypes.
        const field =
          authErrorField(err) ??
          (err instanceof AuthApiError && err.code === "validation_error"
            ? "password"
            : null);
        if (field) setFieldError(field, message);
        else setFormError(message);
      }
      setFailures((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Enter your credentials to open the workspace."
      footer={
        registrationOpen ? (
          <>
            No account yet?{" "}
            <Link
              to="/signup"
              className="font-medium text-primary-emphasis hover:underline"
            >
              Create the owner account
            </Link>
          </>
        ) : null
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
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          enterIndex={AUTH_ENTER_FIRST_FIELD + 1}
        />

        {formError ? (
          <FormAlert message={formError} alertRef={alertRef} />
        ) : null}

        <div data-enter style={{ "--i": AUTH_ENTER_FIRST_FIELD + 2 } as never}>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
