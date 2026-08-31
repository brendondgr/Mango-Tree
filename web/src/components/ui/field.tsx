import { AlertCircle } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled form control with its hint and error wired up.
 *
 * Every screen used to re-implement this, and every screen got some of it
 * wrong: labels were present but `aria-invalid` never was, errors rendered as
 * one red sentence at the bottom of the form with no association to the field
 * that caused them, hints were not referenced by `aria-describedby`, and
 * nothing moved focus on failure. Errors also signalled by colour alone.
 *
 * `Field` clones the child control and injects `id`, `aria-invalid`,
 * `aria-describedby` and `aria-required`, so a correct field is the default
 * rather than something each form has to remember.
 */
export interface FieldProps {
  label: string;
  /** Supply to control the id; otherwise one is generated. */
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Visually hide the label while keeping it for assistive technology. */
  hideLabel?: boolean;
  className?: string;
  children: React.ReactElement;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  hideLabel = false,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const control = React.cloneElement(
    children,
    {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy,
      "aria-required": required || undefined,
      className: cn(
        error && "border-destructive focus-visible:ring-destructive",
        (children.props as { className?: string }).className,
      ),
    } as React.HTMLAttributes<HTMLElement>,
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}

      {control}

      {error && (
        // role="alert" so the message is announced when it appears, and an icon
        // beside the text so the error is not signalled by colour alone.
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Field-level error state for a form.
 *
 * `focusFirstError` exists because moving focus to the first invalid control is
 * the difference between an error a keyboard or screen-reader user can act on
 * and one they have to hunt for.
 */
export function useFormErrors<TField extends string>() {
  const [errors, setErrors] = React.useState<Partial<Record<TField, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const clear = React.useCallback(() => {
    setErrors({});
    setFormError(null);
  }, []);

  const setFieldError = React.useCallback((field: TField, message: string) => {
    setErrors((current) => ({ ...current, [field]: message }));
  }, []);

  const clearFieldError = React.useCallback((field: TField) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const focusFirstError = React.useCallback(
    (form: HTMLFormElement | null) => {
      if (!form) return;
      const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      invalid?.focus();
    },
    [],
  );

  return {
    errors,
    formError,
    setErrors,
    setFormError,
    setFieldError,
    clearFieldError,
    clear,
    focusFirstError,
    hasErrors: Object.keys(errors).length > 0 || formError !== null,
  };
}
