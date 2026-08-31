import { type CSSProperties, type RefObject, useRef } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { MailboxDensity, MailboxPrefs } from "@/app/stores/workspaceStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import type { InboxMessage } from "@mailbox/hooks/useMailbox";
import { type Accent, accentClass, parseSender, providerLabel } from "@mailbox/utils/colors";
import { formatDate } from "@mailbox/utils/format";
import { COLUMN_VARS, listStyle } from "@mailbox/utils/listStyle";

export function messageKey(message: InboxMessage): string {
  return `${message.accountId}:${message.uid}`;
}

interface ItemProps {
  message: InboxMessage;
  index: number;
  active: boolean;
  onSelect: () => void;
  accountAccent: Accent;
  accountLabel: string;
  showAccount: boolean;
  prefs: MailboxPrefs;
}

function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  return (
    <span
      className={cn(
        "mailbox-provider inline-flex shrink-0 items-center justify-center rounded-[var(--radius-pill)]",
        className,
      )}
      title={providerLabel(provider)}
      aria-hidden
    >
      <ProviderIcon provider={provider} className="mailbox-provider-glyph" />
    </span>
  );
}

/**
 * One message as a table row.
 *
 * The grid it sits on reflows from a stacked phone layout to the resizable
 * column table at 34rem of *pane* width (see `.mailbox-grid`), which is what
 * replaces the old 474px hard minimum. `min-h-11` gives the 44px touch target
 * on compact; `app:` steps it back down where a pointer is doing the aiming.
 */
function CompactRow({
  message,
  index,
  active,
  onSelect,
  accountAccent,
  accountLabel,
  showAccount,
  prefs,
}: ItemProps) {
  const sender = parseSender(message.from);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      data-enter
      aria-current={active ? "true" : undefined}
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "mailbox-grid mailbox-row relative w-full border-b border-border/60 text-left",
        "min-h-11 px-3 py-2 pl-4 app:min-h-9",
        prefs.tightRows && "py-1",
        "transition-colors hover:bg-foreground/5",
        "data-[active=true]:bg-primary/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        accentClass(accountAccent),
      )}
    >
      {message.unread && <span className="sr-only">Unread. </span>}

      {prefs.showProviderIcon && (
        <ProviderBadge provider={message.provider} className="mailbox-cell-icon h-7 w-7" />
      )}

      <span
        className={cn(
          "mailbox-cell-from truncate",
          message.unread ? "font-bold text-foreground" : "text-muted-foreground",
        )}
        title={sender.name}
      >
        {sender.name}
      </span>

      <span
        className={cn(
          "mailbox-cell-subject truncate",
          message.unread ? "font-bold text-foreground" : "text-foreground",
        )}
        title={message.subject}
      >
        {message.subject || "(no subject)"}
      </span>

      {prefs.showSnippet && (
        <span className="mailbox-cell-snippet truncate text-muted-foreground">
          {message.snippet}
        </span>
      )}

      {showAccount && prefs.showAccountBadge && (
        <span className="mailbox-cell-account">
          <span
            className={cn(
              "mailbox-badge inline-block max-w-full truncate rounded-[var(--radius-pill)] px-2 py-px",
              "text-[0.66rem] font-bold uppercase tracking-wide",
              accentClass(accountAccent),
            )}
          >
            {accountLabel}
          </span>
        </span>
      )}

      {prefs.showDate && (
        <span className="mailbox-cell-date shrink-0 text-right text-xs text-muted-foreground">
          {formatDate(message.date)}
        </span>
      )}
    </button>
  );
}

/** One message as a card. Modern density; identical data, roomier shape. */
function ModernCard({
  message,
  index,
  active,
  onSelect,
  accountAccent,
  accountLabel,
  showAccount,
  prefs,
}: ItemProps) {
  const sender = parseSender(message.from);
  const showAccountBadge = showAccount && prefs.showAccountBadge;
  const showNew = prefs.showUnreadBadge && message.unread;
  const showBadgeRow = showAccountBadge || prefs.showProviderBadge || showNew;
  const badge =
    "mailbox-badge inline-flex items-center rounded-[var(--radius-pill)] px-2 py-px text-[0.66rem] font-bold uppercase tracking-wide";

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      data-enter
      aria-current={active ? "true" : undefined}
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "mailbox-card relative flex w-full gap-3 overflow-hidden rounded-[var(--radius-md)] text-left",
        "border border-border bg-card p-3",
        prefs.tightRows && "gap-2 p-2",
        "shadow-xs transition-[transform,box-shadow,border-color]",
        "duration-[var(--motion-duration-md)] ease-[var(--motion-ease-standard)]",
        "hover:translate-y-[calc(var(--motion-travel-sm)*-1)] hover:shadow-md",
        "data-[active=true]:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        accentClass(accountAccent),
      )}
    >
      {message.unread && <span className="sr-only">Unread. </span>}

      {prefs.showProviderIcon && (
        <ProviderBadge provider={message.provider} className="h-10 w-10" />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate",
              message.unread ? "font-bold text-foreground" : "text-muted-foreground",
            )}
            title={sender.name}
          >
            {sender.name}
          </span>
          {prefs.showDate && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(message.date)}
            </span>
          )}
        </span>

        <span
          className={cn(
            "mt-0.5 block truncate",
            message.unread ? "font-bold text-foreground" : "text-foreground",
          )}
        >
          {message.subject || "(no subject)"}
        </span>

        {prefs.showSnippet && (
          <span className="mt-1 line-clamp-2 block text-muted-foreground">{message.snippet}</span>
        )}

        {showBadgeRow && (
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {showAccountBadge && (
              <span className={cn(badge, accentClass(accountAccent))}>{accountLabel}</span>
            )}
            {prefs.showProviderBadge && (
              <span className={cn(badge, "mailbox-c-primary")}>
                {providerLabel(message.provider)}
              </span>
            )}
            {showNew && <span className={cn(badge, accentClass(accountAccent))}>New</span>}
          </span>
        )}
      </span>
    </button>
  );
}

// --- resizable compact columns ----------------------------------------------

const COLUMN_BOUNDS = {
  from: { cssVar: COLUMN_VARS.from, min: 80, max: 360, label: "From" },
  subject: { cssVar: COLUMN_VARS.subject, min: 120, max: 560, label: "Subject" },
} as const;

type ResizableColumn = keyof typeof COLUMN_BOUNDS;

/**
 * The divider between two compact columns.
 *
 * Drag was previously the only way to move it, which left keyboard and screen
 * reader users with no route to a setting that changes what they can read. It
 * is now a `separator` with a value, so arrow keys move it 8px (40px with
 * Shift) and Home/End jump to the bounds — the same window-splitter contract a
 * pane divider uses anywhere else. The Customize panel's sliders remain a
 * second, always-visible route to the same two numbers.
 *
 * Pointer moves paint the CSS variable directly on the list and only commit to
 * the store on release: writing every intermediate pixel would re-render every
 * row and touch localStorage on every frame.
 */
function ColumnResizer({
  column,
  prefs,
  listRef,
}: {
  column: ResizableColumn;
  prefs: MailboxPrefs;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const setPrefs = useWorkspaceStore((s) => s.setMailboxPrefs);
  const { cssVar, min, max, label } = COLUMN_BOUNDS[column];
  const width = column === "from" ? prefs.fromWidth : prefs.subjectWidth;
  const live = useRef(width);

  const clamp = (value: number) => Math.max(min, Math.min(max, Math.round(value)));
  const paint = (value: number) => listRef.current?.style.setProperty(cssVar, `${value}px`);
  const commit = (value: number) =>
    setPrefs(column === "from" ? { fromWidth: value } : { subjectWidth: value });

  const onPointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const node = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    live.current = startWidth;
    node.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";

    const onMove = (move: PointerEvent) => {
      live.current = clamp(startWidth + (move.clientX - startX));
      paint(live.current);
    };
    const onUp = () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      commit(live.current);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 8;
    let next: number;
    if (event.key === "ArrowLeft") next = width - step;
    else if (event.key === "ArrowRight") next = width + step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    const value = clamp(next);
    paint(value);
    commit(value);
  };

  return (
    <span
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={`${label} column width`}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "mailbox-col-resize absolute -right-1.5 top-0 flex h-full w-6 cursor-col-resize",
        "items-center justify-center rounded-[var(--radius-sm)] focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
    />
  );
}

function CompactColumnHeader({
  prefs,
  showAccount,
  listRef,
}: {
  prefs: MailboxPrefs;
  showAccount: boolean;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const cell = "relative flex min-w-0 items-center self-stretch overflow-visible";
  return (
    // Hidden exactly where the row stops being a table: below 34rem of pane the
    // row stacks, so a column header would be labelling columns that no longer
    // exist.
    <div
      data-header="true"
      className={cn(
        "mailbox-grid sticky top-0 z-[var(--z-header)] min-h-8 border-b border-border bg-background",
        "px-3 pl-4 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground",
        "select-none",
      )}
    >
      {prefs.showProviderIcon && <span className="mailbox-cell-icon h-7 w-7" aria-hidden />}
      <span className={cn(cell, "mailbox-cell-from")}>
        From
        <ColumnResizer column="from" prefs={prefs} listRef={listRef} />
      </span>
      <span className={cn(cell, "mailbox-cell-subject")}>
        Subject
        <ColumnResizer column="subject" prefs={prefs} listRef={listRef} />
      </span>
      {prefs.showSnippet && <span className={cn(cell, "mailbox-cell-snippet")}>Content</span>}
      {showAccount && prefs.showAccountBadge && (
        <span className={cn(cell, "mailbox-cell-account")}>Account</span>
      )}
      {prefs.showDate && (
        <span className={cn(cell, "mailbox-cell-date justify-end")}>Date</span>
      )}
    </div>
  );
}

// --- list --------------------------------------------------------------------

/** Shape-matched placeholder: the same row rhythm the loaded list will use. */
export function MessageListSkeleton({ density }: { density: MailboxDensity }) {
  if (density === "modern") {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-[var(--radius-md)] border border-border p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-[var(--radius-pill)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-3.5 w-28 shrink-0" />
          <Skeleton className="h-3.5 min-w-0 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface ListProps {
  messages: InboxMessage[];
  density: MailboxDensity;
  selectedKey: string | null;
  onSelect: (message: InboxMessage) => void;
  accountAccent: (accountId: string) => Accent;
  accountLabel: (accountId: string) => string;
  showAccount: boolean;
  prefs: MailboxPrefs;
}

export function MessageList({
  messages,
  density,
  selectedKey,
  onSelect,
  accountAccent,
  accountLabel,
  showAccount,
  prefs,
}: ListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const Item = density === "compact" ? CompactRow : ModernCard;

  return (
    <div
      ref={listRef}
      className={cn("flex flex-col", density === "modern" && "gap-2 p-3")}
      style={listStyle(prefs, showAccount)}
    >
      {density === "compact" && (
        <CompactColumnHeader prefs={prefs} showAccount={showAccount} listRef={listRef} />
      )}
      {messages.map((message, index) => (
        <Item
          key={messageKey(message)}
          message={message}
          index={index}
          active={messageKey(message) === selectedKey}
          onSelect={() => onSelect(message)}
          accountAccent={accountAccent(message.accountId)}
          accountLabel={accountLabel(message.accountId)}
          showAccount={showAccount}
          prefs={prefs}
        />
      ))}
    </div>
  );
}
