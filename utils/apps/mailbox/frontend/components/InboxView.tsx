import { useState } from "react";
import {
  Inbox,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Rows3,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MessageDetail } from "@mailbox/components/MessageDetail";
import { MessageList, messageKey } from "@mailbox/components/MessageList";
import {
  type InboxMessage,
  useAccountMessages,
  useAccounts,
} from "@mailbox/hooks/useMailbox";
import { ACCENTS, type Accent, accentClass, accentForKey } from "@mailbox/utils/colors";
import { SAMPLE_ACCOUNTS, sampleMessagesFor } from "@mailbox/utils/sample";

const FOLDER = "INBOX";

export function InboxView() {
  const density = useWorkspaceStore((s) => s.mailboxDensity);
  const setDensity = useWorkspaceStore((s) => s.setMailboxDensity);
  const setMailboxView = useWorkspaceStore((s) => s.setMailboxView);
  const selectedRaw = useWorkspaceStore((s) => s.mailboxAccountId) ?? "all";
  const setSelectedAccount = useWorkspaceStore((s) => s.setMailboxAccountId);
  const queryClient = useQueryClient();

  const accountsQuery = useAccounts();
  const realAccounts = accountsQuery.data ?? [];
  const credentialed = realAccounts.filter((a) => a.has_credential);

  // Sample mode: auto-on when no live account is usable; user can toggle either way.
  const [sampleManual, setSampleManual] = useState<boolean | null>(null);
  const sampleMode = sampleManual ?? (!accountsQuery.isLoading && credentialed.length === 0);

  const accounts = sampleMode ? SAMPLE_ACCOUNTS : realAccounts;
  const selected =
    selectedRaw !== "all" && !accounts.some((a) => a.id === selectedRaw) ? "all" : selectedRaw;

  const accentByAccount = new Map<string, Accent>();
  accounts.forEach((account, index) => accentByAccount.set(account.id, ACCENTS[index % ACCENTS.length]));
  const accountAccent = (id: string): Accent => accentByAccount.get(id) ?? accentForKey(id);
  const accountLabel = (id: string): string =>
    accounts.find((a) => a.id === id)?.display_name ?? id;

  const live = useAccountMessages(credentialed, FOLDER, !sampleMode);
  const allMessages: InboxMessage[] = sampleMode ? sampleMessagesFor("all") : live.messages;
  const messages =
    selected === "all" ? allMessages : allMessages.filter((m) => m.accountId === selected);
  const isLoading = sampleMode ? false : live.isLoading;
  const unreadCount = messages.filter((m) => m.unread).length;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const openMessage = messages.find((m) => messageKey(m) === openKey) ?? null;

  const refresh = () => {
    if (sampleMode) return;
    queryClient.invalidateQueries({ queryKey: ["mailbox", "messages"] });
    void accountsQuery.refetch();
  };

  const detail = openMessage && (
    <MessageDetail
      message={openMessage}
      accountLabel={accountLabel(openMessage.accountId)}
      accountAccent={accountAccent(openMessage.accountId)}
      folder={FOLDER}
      canFetch={!sampleMode}
      onBack={() => setOpenKey(null)}
      backClassName={density === "modern" ? "lg:hidden" : undefined}
    />
  );

  const listBody = (
    <>
      {sampleMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[color-mix(in_srgb,hsl(var(--primary))_8%,transparent)] px-4 py-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            <span className="font-semibold text-foreground">Sample inbox.</span> This is demo
            data. Add a real account to see live mail.
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => setMailboxView("settings")}
          >
            Add account
          </Button>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
        </div>
      ) : messages.length === 0 ? (
        <EmptyInbox onOpenSettings={() => setMailboxView("settings")} onSample={() => setSampleManual(true)} live={!sampleMode} />
      ) : (
        <MessageList
          messages={messages}
          density={density}
          selectedKey={openKey}
          onSelect={(m) => setOpenKey(messageKey(m))}
          accountAccent={accountAccent}
          accountLabel={accountLabel}
          showAccount={selected === "all"}
        />
      )}
    </>
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
              active={selected === account.id}
              accent={accountAccent(account.id)}
              onClick={() => setSelectedAccount(account.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
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
            variant={sampleMode ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setSampleManual(!sampleMode)}
            title={sampleMode ? "Showing sample data" : "Preview sample data"}
          >
            <Sparkles className="h-4 w-4" />
            {sampleMode ? "Sample" : "Live"}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={refresh} title="Refresh" disabled={sampleMode}>
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
      {density === "compact" ? (
        <div className="mailbox-scroll min-h-0 flex-1 overflow-y-auto">
          {openMessage ? detail : listBody}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div
            className={cn(
              "mailbox-scroll min-h-0 w-full overflow-y-auto lg:w-[440px] lg:shrink-0 lg:border-r lg:border-border",
              openMessage && "hidden lg:block",
            )}
          >
            {listBody}
          </div>
          <div className={cn("min-h-0 flex-1", openMessage ? "block" : "hidden lg:block")}>
            {openMessage ? detail : <DetailPlaceholder />}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountChip({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: Accent | "primary";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn("mailbox-chip", accent === "primary" ? "mailbox-c-primary" : accentClass(accent))}
    >
      <span className="mailbox-dot" aria-hidden />
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

function EmptyInbox({
  onOpenSettings,
  onSample,
  live,
}: {
  onOpenSettings: () => void;
  onSample: () => void;
  live: boolean;
}) {
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
          {live
            ? "No messages here. Add an email account, or preview the sample inbox to see how it looks."
            : "No sample messages match this account."}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" onClick={onOpenSettings} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add account
          </Button>
          {live && (
            <Button size="sm" variant="outline" onClick={onSample} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Sample inbox
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
