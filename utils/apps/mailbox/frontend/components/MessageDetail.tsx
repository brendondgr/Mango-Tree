import { type CSSProperties, useEffect } from "react";
import { X } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { EmailBody } from "@mailbox/components/EmailBody";
import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import type { InboxMessage } from "@mailbox/hooks/useMailbox";
import { useMessage } from "@mailbox/hooks/useMailbox";
import {
  type Accent,
  accentClass,
  parseSender,
  providerLabel,
} from "@mailbox/utils/colors";
import { formatFullDate } from "@mailbox/utils/format";
import { BODY_SIZE } from "@mailbox/utils/listStyle";

interface Props {
  message: InboxMessage;
  accountLabel: string;
  accountAccent: Accent;
  folder: string;
  canFetch: boolean;
  /**
   * Whether to render the Close control. True exactly when the pane is wide
   * enough that `MasterDetail` keeps the list beside the message and therefore
   * renders no Back button of its own.
   */
  showClose: boolean;
  /** Deselect the message. Also bound to Escape. */
  onClose: () => void;
}

/**
 * The reading pane.
 *
 * It no longer carries its own Back button: on a narrow pane `MasterDetail`
 * renders one above it, and stacking two ways out of the same screen was how
 * the old layout ended up with a Back control that was hidden at exactly the
 * width where it mattered. What is added instead is a Close affordance for the
 * wide layout — where nothing else could deselect a message — and Escape, so
 * there is a keyboard route out at every width.
 *
 * Close is gated on a `showClose` prop rather than a container query, because the
 * two measure different boxes. `@[45rem]` resolves against the nearest container
 * ancestor — the workspace root — while `MasterDetail` decides `isNarrow` from
 * its own root, which is one docked customize panel narrower. Panes in between
 * rendered Back and Close at once. The caller now measures that same box.
 *
 * The reading pane is its own query container, so the padding step responds to
 * the width of this column rather than to the workspace behind it.
 */
export function MessageDetail({
  message,
  accountLabel,
  accountAccent,
  folder,
  canFetch,
  showClose,
  onClose,
}: Props) {
  const textSize = useWorkspaceStore((s) => s.mailboxPrefs.textSize);
  const sender = parseSender(message.from);
  // List messages arrive without a body; fetch the full message on open.
  const needsFetch = canFetch && message.body_text === null && message.body_html === null;
  const fetched = useMessage(message.accountId, message.uid, folder, needsFetch);
  const body = message.body_text ?? fetched.data?.body_text ?? "";
  const html = message.body_html ?? fetched.data?.body_html ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to the innermost dismissible thing. While the customize
      // sheet, a select popup or a dialog is open, that is theirs — closing the
      // message underneath as well would take two layers away for one keypress.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const badge =
    "mailbox-badge inline-flex items-center rounded-[var(--radius-pill)] px-2 py-px text-[0.66rem] font-bold uppercase tracking-wide";

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      style={{ containerType: "inline-size" }}
    >
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
        )}
      >
        <div
          className="mx-auto w-full max-w-3xl p-4 @[45rem]:p-7"
          style={{ "--mailbox-body-size": BODY_SIZE[textSize] } as CSSProperties}
        >
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-xl font-semibold leading-snug text-foreground">
              {message.subject || "(no subject)"}
            </h1>
            {/* Narrow panes get MasterDetail's Back instead; showing both would
                be two controls for one action. */}
            {showClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close message"
                title="Close message"
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={cn(
                "mailbox-provider inline-flex h-10 w-10 shrink-0 items-center justify-center",
                "rounded-[var(--radius-pill)]",
                accentClass(accountAccent),
              )}
              title={providerLabel(message.provider)}
              aria-hidden
            >
              <ProviderIcon provider={message.provider} className="mailbox-provider-glyph" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{sender.name}</div>
              <div className="truncate text-xs text-muted-foreground">{sender.email}</div>
            </div>
            <div className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
              {formatFullDate(message.date)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={cn(badge, accentClass(accountAccent))}>{accountLabel}</span>
            <span className={cn(badge, "mailbox-c-primary")}>
              {providerLabel(message.provider)}
            </span>
            <span className="text-xs text-muted-foreground">to {message.to || "you"}</span>
          </div>

          <Separator className="my-5" />

          <AsyncBoundary
            loading={needsFetch && fetched.isLoading}
            error={needsFetch && fetched.isError ? fetched.error : undefined}
            onRetry={() => void fetched.refetch()}
            label="this message"
            skeleton={
              <div className="space-y-2.5" aria-hidden>
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            }
          >
            <EmailBody html={html} text={body} />
          </AsyncBoundary>
        </div>
      </div>
    </div>
  );
}
