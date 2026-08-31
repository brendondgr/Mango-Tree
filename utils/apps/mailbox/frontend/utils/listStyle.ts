// The prefs -> CSS-variable bridge for the compact list.
//
// The compact row is a grid whose tracks are variables (see mailbox.css). Every
// track that can be switched off by a preference resolves to `0px` rather than
// being left at its natural width, so turning a column off actually reclaims
// its space instead of leaving a hole. Widths stay in CSS variables — not React
// state — so the drag handles can retitle a column at pointer speed without
// re-rendering several hundred rows.

import type { CSSProperties } from "react";

import type { MailboxPrefs, MailboxTextSize } from "@/app/stores/workspaceStore";

const TEXT_SIZE: Record<MailboxTextSize, string> = {
  sm: "0.8rem",
  md: "0.9rem",
  lg: "1.02rem",
};

/** Reading-pane body size, kept in step with the list's text-size preference. */
export const BODY_SIZE: Record<MailboxTextSize, string> = {
  sm: "0.85rem",
  md: "0.9rem",
  lg: "1.02rem",
};

export const COLUMN_VARS = {
  from: "--mb-from-w",
  subject: "--mb-subject-w",
} as const;

export function listStyle(prefs: MailboxPrefs, showAccount: boolean): CSSProperties {
  return {
    // Set as a real font-size so every descendant inherits it; the row cells
    // then only override where they mean to (dates, badges).
    fontSize: TEXT_SIZE[prefs.textSize],
    "--mb-text": TEXT_SIZE[prefs.textSize],
    [COLUMN_VARS.from]: `${prefs.fromWidth}px`,
    [COLUMN_VARS.subject]: `${prefs.subjectWidth}px`,
    "--mb-snippet-track": prefs.snippetWidth > 0 ? `${prefs.snippetWidth}px` : "1fr",
    "--mb-icon-track": prefs.showProviderIcon ? "1.75rem" : "0px",
    "--mb-account-track": showAccount && prefs.showAccountBadge ? "7.5rem" : "0px",
    "--mb-date-track": prefs.showDate ? "4rem" : "0px",
  } as CSSProperties;
}
