import { type CSSProperties, useState } from "react";
import {
  AlertCircle,
  Inbox,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Rows3,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CustomizePanel } from "@mailbox/components/CustomizePanel";
import { MessageDetail } from "@mailbox/components/MessageDetail";
import { MessageList, messageKey } from "@mailbox/components/MessageList";
import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import {
  type InboxMessage,
  useAccountMessages,
  useAccounts,
  useMailboxAutoSync,
} from "@mailbox/hooks/useMailbox";
import { syncAccount } from "@/services/mailboxClient";
import { type Accent, accentClass, accentForAccount } from "@mailbox/utils/colors";

const FOLDER = "INBOX";

export function InboxView() {
  const density = useWorkspaceStore((s) => s.mailboxDensity);
  const setDensity = useWorkspaceStore((s) => s.setMailboxDensity);
  const prefs = useWorkspaceStore((s) => s.mailboxPrefs);
  const setMailboxView = useWorkspaceStore((s) => s.setMailboxView);
  const selectedRaw = useWorkspaceStore((s) => s.mailboxAccountId) ?? "all";
  const setSelectedAccount = useWorkspaceStore((s) => s.setMailboxAccountId);
  const queryClient = useQueryClient();

  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];
  const credentialed = accounts.filter((a) => a.has_credential);

  const selected =
    selectedRaw !== "all" && !accounts.some((a) => a.id === selectedRaw) ? "all" : selectedRaw;

  const accentByAccount = new Map<string, Accent>();
  accounts.forEach((account) => accentByAccount.set(account.id, accentForAccount(account)));
  const accountAccent = (id: string): Accent => accentByAccount.get(id) ?? accentForAccount({ id });
  const accountLabel = (id: string): string =>
    accounts.find((a) => a.id === id)?.display_name ?? id;

  const live = useAccountMessages(credentialed, FOLDER, true, prefs.loadLimit);
  useMailboxAutoSync(credentialed, FOLDER);
  const allMessages: InboxMessage[] = live.messages;
  const messages =
    selected === "all" ? allMessages : allMessages.filter((m) => m.accountId === selected);
  const isLoading = live.isLoading;
  const unreadCount = messages.filter((m) => m.unread).length;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const openMessage = messages.find((m) => messageKey(m) === openKey) ?? null;

  const refresh = () => {
    for (const account of credentialed) void syncAccount(account.id, FOLDER).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["mailbox", "messages"] });
    void accountsQuery.refetch();
  };

  const detail = openMessage && (
    <MessageDetail
      message={openMessage}
      accountLabel={accountLabel(openMessage.accountId)}
      accountAccent={accountAccent(openMessage.accountId)}
      folder={FOLDER}
      canFetch
      onBack={() => setOpenKey(null)}
      backClassName={density === "modern" ? "lg:hidden" : undefined}
    />
  );

  const listBody = isLoading ? (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
    </div>
  ) : messages.length === 0 ? (
    live.sync.isSyncing ? (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {live.sync.total > 0
          ? `Fetching your mail… ${live.sync.processed}/${live.sync.total}`
          : "Fetching your mail…"}
      </div>
    ) : (
      <EmptyInbox onOpenSettings={() => setMailboxView("settings")} />
    )
  ) : (
    <MessageList
      messages={messages}
      density={density}
      selectedKey={openKey}
      onSelect={(m) => setOpenKey(messageKey(m))}
      accountAccent={accountAccent}
      accountLabel={accountLabel}
      showAccount={selected === "all"}
      prefs={prefs}
    />
  );

  return (
    <div className="mailbox-app flex min-h-0 flex-1 flex-col bg-background">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <AccountChip
            label="All"
            active={selected === "all"}
            accent="primary"
            onClick={() => setSelectedAccount("all")}
          />
          {accounts.map((account) => (
            <AccountChip
              key={account.id}
              label={account.display_name}
              provider={account.provider}
              active={selected === account.id}
              accent={accountAccent(account.id)}
              onClick={() => setSelectedAccount(account.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {live.sync.isSyncing ? (
            <span className="mailbox-sync">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {live.sync.total > 0
                ? `Syncing ${live.sync.processed}/${live.sync.total}…`
                : "Syncing…"}
            </span>
          ) : live.sync.error ? (
            <span className="mailbox-sync text-destructive" title={live.sync.error}>
              <AlertCircle className="h-3.5 w-3.5" /> Sync failed
            </span>
          ) : null}
          <span className="hidden px-1 text-xs text-muted-foreground sm:inline">
            {messages.length} · {unreadCount} unread
          </span>
          <div className="mailbox-seg" role="group" aria-label="Inbox density">
            <button
              type="button"
              className="mailbox-seg-btn"
              data-active={density === "compact"}
              onClick={() => setDensity("compact")}
            >
              <Rows3 className="h-3.5 w-3.5" /> Compact
            </button>
            <button
              type="button"
              className="mailbox-seg-btn"
              data-active={density === "modern"}
              onClick={() => setDensity("modern")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Modern
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            data-active={customizeOpen}
            onClick={() => setCustomizeOpen((o) => !o)}
            title="Customize inbox"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={refresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMailboxView("settings")}
            title="Email accounts"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* body */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {density === "compact" ? (
          <div className="mailbox-scroll min-h-0 flex-1 overflow-y-auto">
            {openMessage ? detail : listBody}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div
              className={cn(
                "mailbox-scroll mailbox-list-pane min-h-0 overflow-y-auto lg:shrink-0 lg:border-r lg:border-border",
                openMessage && "hidden lg:block",
              )}
              style={{ "--mb-list-w": `${prefs.listWidth}px` } as CSSProperties}
            >
              {listBody}
            </div>
            <div className={cn("min-h-0 flex-1", openMessage ? "block" : "hidden lg:block")}>
              {openMessage ? detail : <DetailPlaceholder />}
            </div>
          </div>
        )}
        <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      </div>
    </div>
  );
}

function AccountChip({
  label,
  active,
  accent,
  provider,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: Accent | "primary";
  provider?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn("mailbox-chip", accent === "primary" ? "mailbox-c-primary" : accentClass(accent))}
    >
      {provider ? (
        <ProviderIcon provider={provider} className="mailbox-chip-icon" />
      ) : (
        <Inbox className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}

function DetailPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-10 text-center text-muted-foreground">
      <div>
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted"
          aria-hidden
        >
          <Inbox className="h-6 w-6" />
        </div>
        <p className="text-sm">Select a message to read it here.</p>
      </div>
    </div>
  );
}

function EmptyInbox({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-10 text-center">
      <div className="max-w-sm">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted text-muted-foreground"
          aria-hidden
        >
          <Inbox className="h-6 w-6" />
        </div>
        <h3 className="mb-2 text-base font-semibold text-foreground">Nothing to show yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          No messages here. Add an email account to start reading live mail.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" onClick={onOpenSettings} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add account
          </Button>
        </div>
      </div>
    </div>
  );
}
