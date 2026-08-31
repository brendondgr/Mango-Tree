import { ArrowBigUp, Check, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import type { ReactNode } from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useShellLayout } from "@/hooks/useShellLayout";
import { cn } from "@/lib/utils";
import { AuthApiError } from "@/services/authClient";

/** One line, and it must stay one line at 360px — see the fold budget below. */
const TAGLINE = "Your local-first agent workspace.";

const POSITIONING =
  "Your agent, your apps and your data, all running on the machine in front of you.";

const CAPABILITIES = [
  "Local-first",
  "Your agent, your machine",
  "Eight apps, one workspace",
];

/**
 * Shared stagger ladder for the entrance choreography, so the two screens and
 * this shell cannot drift apart: 0 lockup, 1 card heading, 2+ form controls,
 * 6 footer. `--motion-stagger-max` caps the delay at 6, which is why the
 * footer sits there rather than at "one past the last field".
 */
const AUTH_ENTER_HEADING = 1;
export const AUTH_ENTER_FIRST_FIELD = 2;
const AUTH_ENTER_FOOTER = 6;

/**
 * The brand mark, drawn inline.
 *
 * These screens used to `import` a 212 kB colour SVG and paint it at 320px: a
 * quarter-megabyte fetch before the first field, and a lockup tall enough on
 * its own to push the password box and the submit button off a 360x640 phone
 * screen. This mark is a few hundred bytes of markup, costs no request, and
 * inherits `currentColor` so it recolours with the theme instead of needing a
 * second, dark-mode copy.
 */
function MangoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      focusable="false"
      className={className}
    >
      <ellipse
        cx="32"
        cy="39"
        rx="19"
        ry="17"
        transform="rotate(-14 32 39)"
        fill="currentColor"
      />
      <path
        d="M34 21c1-8 8-14 17-15 1 9-6 16-14 16Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M32 27c-.5-4 .3-7 2-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Decorative brand pane, expanded shell only.
 *
 * `aria-hidden` because it is garnish: the page's real `<h1>` lives in the form
 * column, and a screen-reader user should land on the form rather than wade
 * through a wordmark and three marketing lines first.
 *
 * It is gated in JS rather than with `max-app:hidden` because a CSS-hidden
 * panel is still parsed and laid out on the phone that least wants it.
 *
 * The gradient is the theme's own `--brand-gradient`, washed over `surface-2`
 * rather than used at full strength: those gradients run from garnet to cyan
 * across the eight themes, and text on a raw cyan is a ~2:1 contrast failure.
 * A wash keeps the brand colour while `text-foreground` stays legible on all
 * of them.
 */
function BrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative flex w-[57%] shrink-0 flex-col justify-center overflow-hidden border-r border-border bg-surface-2 px-12 py-16"
    >
      {/* Painted before the content and left unpositioned there, so ordinary
          paint order puts the copy on top without inventing a z-index. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 12% 8%, hsl(var(--primary) / 0.20), transparent 62%)",
        }}
      />

      <div className="relative max-w-md">
        <div
          data-enter
          style={{ "--i": 0 } as never}
          className="flex items-center gap-4"
        >
          <MangoMark className="h-14 w-14 shrink-0 text-primary-emphasis" />
          <span className="text-4xl font-semibold tracking-tight">
            Mango Tree
          </span>
        </div>

        {/* `text-foreground`, not `text-muted-foreground`: measured over the
            washed panel the muted token lands between 2.9:1 and 5.4:1 across
            the eight themes, so hierarchy here comes from size, not colour. */}
        <p
          data-enter
          style={{ "--i": 1 } as never}
          className="mt-5 text-lg leading-relaxed text-foreground"
        >
          {POSITIONING}
        </p>

        <ul className="mt-10 space-y-4">
          {CAPABILITIES.map((line, index) => (
            <li
              key={line}
              data-enter
              style={{ "--i": index + 2 } as never}
              className="flex items-center gap-3 text-base"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-primary-emphasis shadow-xs">
                <Check className="h-4 w-4" />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/**
 * Branded entry shell for the login and signup screens.
 *
 * Compact is one column and is budgeted to the fold at 360x640: a 64px mark,
 * the `<h1>`, one line of positioning, then the card. Anything added to the
 * lockup comes out of the form's headroom, so keep the tagline to one line.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { isCompact } = useShellLayout();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {isCompact ? null : <BrandPanel />}

      {/* `my-auto` on the child rather than `items-center` on the parent: with
          align-items:center, content taller than the container overflows at BOTH
          ends and the top is unreachable by scrolling. Auto margins centre when
          there is room and collapse to zero when there is not — which is what an
          error message or a caps-lock warning pushing the form past a 640px
          phone viewport needs. */}
      <main className="flex flex-1 justify-center overflow-y-auto px-5 py-4 app:px-10 app:py-12">
        <div className="my-auto w-full max-w-sm">
          {isCompact ? (
            <div
              data-enter
              style={{ "--i": 0 } as never}
              className="mb-5 text-center"
            >
              <MangoMark className="mx-auto h-16 w-16 text-primary-emphasis" />
              <h1 className="mt-3 text-xl font-semibold tracking-tight">
                Mango Tree
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{TAGLINE}</p>
            </div>
          ) : (
            // The wordmark next door is decorative, so the page still needs a
            // real heading — it just must not be drawn a second time.
            <h1 className="sr-only">Mango Tree</h1>
          )}

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm app:p-6">
            <div
              data-enter
              style={{ "--i": AUTH_ENTER_HEADING } as never}
              className="mb-5"
            >
              <h2 className="text-base font-semibold app:text-lg">{title}</h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>

          {footer ? (
            <p
              data-enter
              style={{ "--i": AUTH_ENTER_FOOTER } as never}
              className="mt-3 text-center text-sm text-muted-foreground"
            >
              {footer}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

type PasswordControlProps = React.ComponentProps<"input"> & {
  revealed: boolean;
  onToggleReveal: () => void;
};

/**
 * The control `Field` clones. It forwards the injected `id`, `aria-*` and
 * error `className` to the real `<input>` — putting them on the wrapper would
 * break both the label association and `focusFirstError`, which looks for
 * `[aria-invalid="true"]` and calls `focus()` on it.
 */
function PasswordControl({
  revealed,
  onToggleReveal,
  className,
  ...props
}: PasswordControlProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        type={revealed ? "text" : "password"}
        className={cn("pr-12 app:pr-10", className)}
      />
      <button
        type="button"
        onClick={onToggleReveal}
        aria-label={revealed ? "Hide password" : "Show password"}
        // inset-y-0 matches the input's own height, so the target is 44px on
        // compact and steps down with the input at app:.
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring app:w-10"
      >
        {revealed ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

/**
 * A password field with a reveal toggle and a caps-lock warning.
 *
 * Both matter more on a phone than on a desktop: the keyboard is invisible,
 * the shift state is not, and a mistyped password that cannot be read back is
 * the most common way this screen fails.
 */
export function PasswordField({
  label,
  name,
  hint,
  error,
  value,
  onChange,
  autoComplete,
  enterIndex,
}: {
  label: string;
  /**
   * Form control name. Password managers and browser autofill key off this as
   * well as `autocomplete`, so it is not optional even though React does not
   * need it.
   */
  name: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  enterIndex: number;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);

  // getModifierState only exists on the event, so caps lock can be detected
  // from the first keystroke onwards — which is when it starts mattering.
  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  return (
    <div data-enter style={{ "--i": enterIndex } as never}>
      <Field label={label} hint={hint} error={error} required>
        <PasswordControl
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          revealed={revealed}
          onToggleReveal={() => setRevealed((current) => !current)}
          onKeyDown={trackCapsLock}
          onKeyUp={trackCapsLock}
          onBlur={() => setCapsLock(false)}
        />
      </Field>

      {/* Mounted even when silent: a live region that appears at the same
          moment as its text is not reliably announced. Empty, it has no line
          box and costs the fold budget nothing. */}
      <p
        role="status"
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium text-foreground",
          capsLock && "mt-1.5",
        )}
      >
        {capsLock ? (
          <>
            <ArrowBigUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Caps Lock is on.
          </>
        ) : null}
      </p>
    </div>
  );
}

/** Form-level failures: a lockout, an unreachable server, a closed signup. */
export function FormAlert({
  message,
  alertRef,
}: {
  message: string;
  alertRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  return (
    // tabIndex -1 so a failure that belongs to no single field can still take
    // focus; otherwise a rate-limit message is announced to nobody.
    <p
      ref={alertRef}
      role="alert"
      tabIndex={-1}
      className="rounded-[var(--radius-sm)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {message}
    </p>
  );
}

/**
 * Which input caused a backend rejection.
 *
 * The auth API tags validation failures with `details.field`, and reports
 * password-policy failures as a list under `details.errors`. Mapping that back
 * onto a field is what puts the message beside the offending input instead of
 * leaving it as a red sentence at the bottom of the form.
 */
export function authErrorField(error: unknown): "username" | "password" | null {
  if (!(error instanceof AuthApiError)) return null;
  const details = error.details as { field?: string; errors?: string[] } | null;
  if (details?.errors?.length) return "password";
  if (details?.field === "username" || details?.field === "password") {
    return details.field;
  }
  return null;
}

/** The message to show, expanding the password-policy list when there is one. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError) {
    const details = error.details as { errors?: string[] } | null;
    if (details?.errors?.length) return details.errors.join(" ");
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
