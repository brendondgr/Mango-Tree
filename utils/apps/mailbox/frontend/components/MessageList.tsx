import { type CSSProperties, useRef } from "react";

import { cn } from "@/lib/utils";
import type { MailboxDensity, MailboxPrefs } from "@/app/stores/workspaceStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import type { InboxMessage } from "@mailbox/hooks/useMailbox";
import { type Accent, accentClass, parseSender, providerLabel } from "@mailbox/utils/colors";
import { formatDate } from "@mailbox/utils/format";

interface ItemProps {
  message: InboxMessage;
  active: boolean;
  onSelect: () => void;
  accountAccent: Accent;
  accountLabel: string;
  showAccount: boolean;
  prefs: MailboxPrefs;
}

function CompactRow({ message, active, onSelect, accountAccent, accountLabel, showAccount, prefs }: ItemProps) {
  const sender = parseSender(message.from);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      data-tight={prefs.tightRows}
      className={cn("mailbox-row w-full text-left", accentClass(accountAccent))}
    >
      {prefs.showProviderIcon && (
        <span className="mailbox-provider h-7 w-7" title={providerLabel(message.provider)} aria-hidden>
          <ProviderIcon provider={message.provider} className="mailbox-provider-glyph" />
        </span>
      )}
      <span
        className={cn("mailbox-col-from truncate", message.unread ? "mailbox-unread-strong" : "mailbox-read")}
        title={sender.name}
      >
        {sender.name}
      </span>
      <span
        className={cn(
          "mailbox-col-subject truncate",
          message.unread ? "mailbox-unread-strong" : "text-foreground",
        )}
        title={message.subject}
      >
        {message.subject || "(no subject)"}
      </span>
      {prefs.showSnippet && (
        <span className="mailbox-col-snippet truncate text-muted-foreground" data-capped={prefs.snippetWidth > 0}>
          {message.snippet ? `— ${message.snippet}` : ""}
        </span>
      )}
      {showAccount && prefs.showAccountBadge && (
        <span className={cn("mailbox-badge hidden sm:inline-flex", accentClass(accountAccent))}>
          {accountLabel}
        </span>
      )}
      {prefs.showDate && (
        <span className="mailbox-col-date shrink-0 text-right text-xs text-muted-foreground">
          {formatDate(message.date)}
        </span>
      )}
    </button>
  );
}

function ModernCard({ message, active, onSelect, accountAccent, accountLabel, showAccount, prefs }: ItemProps) {
  const sender = parseSender(message.from);
  const showAccountBadge = showAccount && prefs.showAccountBadge;
  const showNew = prefs.showUnreadBadge && message.unread;
  const showBadgeRow = showAccountBadge || prefs.showProviderBadge || showNew;
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      data-tight={prefs.tightRows}
      className={cn("mailbox-card w-full text-left", accentClass(accountAccent))}
    >
      {prefs.showProviderIcon && (
        <span className="mailbox-provider h-10 w-10" title={providerLabel(message.provider)} aria-hidden>
          <ProviderIcon provider={message.provider} className="mailbox-provider-glyph" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn("truncate", message.unread ? "mailbox-unread-strong" : "mailbox-read")}
            title={sender.name}
          >
            {sender.name}
          </span>
          {prefs.showDate && (
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(message.date)}</span>
          )}
        </div>
        <div className={cn("mt-0.5 truncate", message.unread ? "mailbox-unread-strong" : "text-foreground")}>
          {message.subject || "(no subject)"}
        </div>
        {prefs.showSnippet && (
          <div className="mt-1 line-clamp-2 text-muted-foreground">{message.snippet}</div>
        )}
        {showBadgeRow && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {showAccountBadge && (
              <span className={cn("mailbox-badge", accentClass(accountAccent))}>{accountLabel}</span>
            )}
            {prefs.showProviderBadge && (
              <span className="mailbox-badge mailbox-c-primary opacity-80">
                {providerLabel(message.provider)}
              </span>
            )}
            {showNew && <span className={cn("mailbox-badge", accentClass(accountAccent))}>New</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function CompactColumnHeader({ prefs }: { prefs: MailboxPrefs }) {
  const setPrefs = useWorkspaceStore((s) => s.setMailboxPrefs);
  const dragRef = useRef<{
    col: "from" | "subject";
    startX: number;
    startWidth: number;
  } | null>(null);

  const startDrag = (col: "from" | "subject", e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      col,
      startX: e.clientX,
      startWidth: col === "from" ? prefs.fromWidth : prefs.subjectWidth,
    };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = me.clientX - dragRef.current.startX;
      const raw = dragRef.current.startWidth + delta;
      const [min, max] = col === "from" ? [80, 360] : [120, 560];
      const newWidth = Math.max(min, Math.min(max, raw));
      setPrefs(col === "from" ? { fromWidth: newWidth } : { subjectWidth: newWidth });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="mailbox-col-header">
      {prefs.showProviderIcon && <span className="mailbox-provider h-7 w-7" aria-hidden />}
      <span className="mailbox-col-from mailbox-col-header-cell">
        From
        <span
          className="mailbox-col-resize"
          onMouseDown={(e) => startDrag("from", e)}
          title="Drag to resize"
          aria-hidden
        />
      </span>
      <span className="mailbox-col-subject mailbox-col-header-cell">
        Subject
        <span
          className="mailbox-col-resize"
          onMouseDown={(e) => startDrag("subject", e)}
          title="Drag to resize"
          aria-hidden
        />
      </span>
      {prefs.showSnippet && (
        <span className="mailbox-col-snippet mailbox-col-header-cell">Preview</span>
      )}
      {prefs.showDate && (
        <span className="mailbox-col-date text-right">Date</span>
      )}
    </div>
  );
}

export function messageKey(message: InboxMessage): string {
  return `${message.accountId}:${message.uid}`;
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
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        No messages in this folder.
      </div>
    );
  }

  const listStyle = {
    "--mb-from-w": `${prefs.fromWidth}px`,
    "--mb-subject-w": `${prefs.subjectWidth}px`,
    "--mb-snippet-w": `${prefs.snippetWidth}px`,
  } as CSSProperties;

  const Item = density === "compact" ? CompactRow : ModernCard;

  return (
    <div
      className={cn("mailbox-list", density === "compact" ? "flex flex-col" : "flex flex-col gap-2 p-3")}
      data-text={prefs.textSize}
      style={listStyle}
    >
      {density === "compact" && <CompactColumnHeader prefs={prefs} />}
      {messages.map((message) => (
        <Item
          key={messageKey(message)}
          message={message}
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
