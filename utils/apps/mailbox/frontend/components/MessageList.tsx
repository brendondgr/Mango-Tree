import { cn } from "@/lib/utils";
import type { MailboxDensity } from "@/app/stores/workspaceStore";

import type { InboxMessage } from "@mailbox/hooks/useMailbox";
import {
  type Accent,
  accentClass,
  accentForKey,
  initial,
  parseSender,
  providerLabel,
} from "@mailbox/utils/colors";
import { formatDate } from "@mailbox/utils/format";

interface ItemProps {
  message: InboxMessage;
  active: boolean;
  onSelect: () => void;
  accountAccent: Accent;
  accountLabel: string;
  showAccount: boolean;
}

function CompactRow({ message, active, onSelect, accountAccent, accountLabel, showAccount }: ItemProps) {
  const sender = parseSender(message.from);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      className={cn("mailbox-row w-full text-left", accentClass(accountAccent))}
    >
      <span
        className={cn("mailbox-avatar h-7 w-7 text-[0.7rem]", accentClass(accentForKey(sender.email)))}
        aria-hidden
      >
        {initial(sender.name)}
      </span>
      <span
        className={cn(
          "w-36 shrink-0 truncate text-sm",
          message.unread ? "mailbox-unread-strong" : "mailbox-read",
        )}
        title={sender.name}
      >
        {sender.name}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span
          className={cn(
            "shrink-0 max-w-[55%] truncate text-sm",
            message.unread ? "mailbox-unread-strong" : "text-foreground",
          )}
        >
          {message.subject || "(no subject)"}
        </span>
        <span className="truncate text-sm text-muted-foreground">— {message.snippet}</span>
      </span>
      {showAccount && (
        <span className={cn("mailbox-badge hidden sm:inline-flex", accentClass(accountAccent))}>
          {accountLabel}
        </span>
      )}
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {formatDate(message.date)}
      </span>
    </button>
  );
}

function ModernCard({ message, active, onSelect, accountAccent, accountLabel, showAccount }: ItemProps) {
  const sender = parseSender(message.from);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      data-unread={message.unread}
      className={cn("mailbox-card w-full text-left", accentClass(accountAccent))}
    >
      <span
        className={cn("mailbox-avatar h-10 w-10 text-sm", accentClass(accentForKey(sender.email)))}
        aria-hidden
      >
        {initial(sender.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              message.unread ? "mailbox-unread-strong" : "mailbox-read",
            )}
            title={sender.name}
          >
            {sender.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(message.date)}
          </span>
        </div>
        <div
          className={cn(
            "mt-0.5 truncate text-sm",
            message.unread ? "mailbox-unread-strong" : "text-foreground",
          )}
        >
          {message.subject || "(no subject)"}
        </div>
        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{message.snippet}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showAccount && (
            <span className={cn("mailbox-badge", accentClass(accountAccent))}>{accountLabel}</span>
          )}
          <span className="mailbox-badge mailbox-c-primary opacity-80">
            {providerLabel(message.provider)}
          </span>
          {message.unread && (
            <span className={cn("mailbox-badge", accentClass(accountAccent))}>New</span>
          )}
        </div>
      </div>
    </button>
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
}

export function MessageList({
  messages,
  density,
  selectedKey,
  onSelect,
  accountAccent,
  accountLabel,
  showAccount,
}: ListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        No messages in this folder.
      </div>
    );
  }

  if (density === "compact") {
    return (
      <div className="flex flex-col">
        {messages.map((message) => (
          <CompactRow
            key={`${message.accountId}:${message.uid}`}
            message={message}
            active={messageKey(message) === selectedKey}
            onSelect={() => onSelect(message)}
            accountAccent={accountAccent(message.accountId)}
            accountLabel={accountLabel(message.accountId)}
            showAccount={showAccount}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {messages.map((message) => (
        <ModernCard
          key={`${message.accountId}:${message.uid}`}
          message={message}
          active={messageKey(message) === selectedKey}
          onSelect={() => onSelect(message)}
          accountAccent={accountAccent(message.accountId)}
          accountLabel={accountLabel(message.accountId)}
          showAccount={showAccount}
        />
      ))}
    </div>
  );
}
