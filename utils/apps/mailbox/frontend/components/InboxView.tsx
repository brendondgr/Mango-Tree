import { useEffect, useState } from "react";
import {
  AlertCircle,
  Inbox,
  LayoutGrid,
  Loader2,
  MailX,
  Plus,
  RefreshCw,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  type MailboxDensity,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { MasterDetail, useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import { CustomizePanel } from "@mailbox/components/CustomizePanel";
import { MailboxNav } from "@mailbox/components/MailboxNav";
import { MessageDetail } from "@mailbox/components/MessageDetail";
import {
  MessageList,
  MessageListSkeleton,
  messageKey,
} from "@mailbox/components/MessageList";
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

const DENSITY_OPTIONS = [
  { value: "compact" as MailboxDensity, label: "Compact", icon: Rows3 },
  { value: "modern" as MailboxDensity, label: "Modern", icon: LayoutGrid },
];

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
  const unreadCount = messages.filter((m) => m.unread).length;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const openMessage = messages.find((m) => messageKey(m) === openKey) ?? null;

  // The preferences panel docks beside the list on a wide pane and becomes a
  // bottom sheet on a narrow one, which the width of the whole body decides.
  const [bodyRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();
  // MasterDetail switches to one column at a time on the width of ITS root —
  // the box below, which is one docked panel narrower than the body. Anything
  // that has to agree with its Back button must read the same measurement; a
  // container query against the workspace root does not.
  const [paneRef, isNarrowPane] = useIsNarrowPane<HTMLDivElement>();

  const refresh = () => {
    for (const account of credentialed) void syncAccount(account.id, FOLDER).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["mailbox", "messages"] });
    void accountsQuery.refetch();
  };

  // --- async state: error beats loading beats empty ---------------------------
  const noAccounts = !accountsQuery.isLoading && credentialed.length === 0;
  // `useMailboxAutoSync` fires every 10s, so counting a background sync as
  // loading made a genuinely empty inbox alternate between the skeleton and its
  // empty state forever. The skeleton belongs to the first load only; later
  // syncs are reported by SyncStatus in the header instead.
  const busy =
    accountsQuery.isLoading ||
    (credentialed.length > 0 &&
      allMessages.length === 0 &&
      (live.isLoading || live.sync.isSyncing));
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  useEffect(() => {
    if (!busy) setFirstLoadDone(true);
  }, [busy]);
  const loading = busy && !firstLoadDone;
  const error =
    accountsQuery.error ??
    (messages.length === 0 && (live.sync.error || live.errorCount > 0)
      ? new Error(live.sync.error ?? "Couldn't reach your mail server.")
      : undefined);
  const filteredOut = selected !== "all" && messages.length === 0 && allMessages.length > 0;

  const empty = messages.length === 0;
  const emptyProps = noAccounts
    ? {
        emptyIcon: Inbox,
        emptyTitle: "No email accounts yet",
        emptyDescription:
          "Connect a Gmail, Microsoft 365, Exchange or Yahoo account to start reading live mail here.",
        emptyAction: (
          <Button onClick={() => setMailboxView("settings")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add account
          </Button>
        ),
      }
    : filteredOut
      ? {
          emptyIcon: MailX,
          emptyTitle: `Nothing from ${accountLabel(selected)}`,
          emptyDescription: `${allMessages.length} messages are waiting on your other accounts.`,
          emptyAction: (
            <Button variant="outline" onClick={() => setSelectedAccount("all")}>
              Show all accounts
            </Button>
          ),
        }
      : {
          emptyIcon: Inbox,
          emptyTitle: "Inbox is empty",
          emptyDescription: "New mail arrives here automatically as it is synced.",
          emptyAction: (
            <Button variant="outline" onClick={refresh} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Check for mail
            </Button>
          ),
        };

  const list = (
    // The container every compact row sizes itself against. Pane width, not
    // viewport width, is what decides whether the row is a table or a stack.
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{ containerType: "inline-size" }}
    >
      <AccountFilterStrip
        accounts={accounts}
        selected={selected}
        onSelect={setSelectedAccount}
        accountAccent={accountAccent}
      />
      <AsyncBoundary
        loading={loading}
        error={error}
        empty={empty}
        onRetry={refresh}
        label="your inbox"
        skeleton={<MessageListSkeleton density={density} />}
        className={cn(
          "scroll-region min-h-0 flex-1 overflow-y-auto",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
        )}
        {...emptyProps}
      >
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
      </AsyncBoundary>
    </div>
  );

  const detail = openMessage ? (
    <MessageDetail
      message={openMessage}
      accountLabel={accountLabel(openMessage.accountId)}
      accountAccent={accountAccent(openMessage.accountId)}
      folder={FOLDER}
      canFetch
      showClose={!isNarrowPane}
      onClose={() => setOpenKey(null)}
    />
  ) : (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <EmptyState
        icon={Inbox}
        title="No message selected"
        description="Choose a message from the list to read it here."
      />
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <AppHeader
        icon={Inbox}
        title="Mailbox"
        description={`${messages.length} message${messages.length === 1 ? "" : "s"} · ${unreadCount} unread`}
        // Both switchers live in `nav`, which AppHeader gives a full row of its
        // own. Putting the density control in `actions` squeezed the title block
        // to 31px on a 360px pane — the actions are `shrink-0`, so the app name
        // is what gives way. Here the two strips wrap past each other instead.
        nav={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MailboxNav />
            <DensityToggle value={density} onChange={setDensity} />
          </div>
        }
        actions={
          <>
            <SyncStatus
              isSyncing={live.sync.isSyncing}
              processed={live.sync.processed}
              total={live.sync.total}
              error={live.sync.error}
              onRetry={refresh}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={customizeOpen}
              onClick={() => setCustomizeOpen((o) => !o)}
              aria-label="Customize inbox"
              title="Customize inbox"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              aria-label="Refresh inbox"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div ref={paneRef} className="flex min-h-0 min-w-0 flex-1">
          <MasterDetail
            list={list}
            detail={detail}
            selected={Boolean(openMessage)}
            onBack={() => setOpenKey(null)}
            detailTitle={openMessage?.subject || undefined}
            listWidth={
              density === "compact" ? "clamp(24rem, 60%, 56rem)" : `${prefs.listWidth}px`
            }
          />
        </div>
        <CustomizePanel open={customizeOpen} onOpenChange={setCustomizeOpen} narrow={isNarrow} />
      </div>
    </div>
  );
}

function SyncStatus({
  isSyncing,
  processed,
  total,
  error,
  onRetry,
}: {
  isSyncing: boolean;
  processed: number;
  total: number;
  error: string | null;
  onRetry: () => void;
}) {
  if (isSyncing) {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {total > 0 ? `Syncing ${processed}/${total}…` : "Syncing…"}
      </span>
    );
  }
  if (error) {
    return (
      // The reason used to live only in `title` — a mouse-only affordance on a
      // span that cannot be focused, so keyboard and touch users got "Sync
      // failed" with no way to learn why and no way to try again.
      <span
        className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-destructive"
        role="status"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 max-w-[12rem] break-words">Sync failed: {error}</span>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry}>
          Retry
        </Button>
      </span>
    );
  }
  return null;
}

/**
 * Compact vs Modern.
 *
 * Was a `SegmentedControl`, which renders `tablist` / `tab` / `aria-selected`
 * with no tabpanels behind it — so this sat beside `MailboxNav` as a second set
 * of page tabs in one header row. A display-mode switch is a pair of toggle
 * buttons instead: `aria-pressed` inside a `group`, each its own tab stop.
 */
function DensityToggle({
  value,
  onChange,
}: {
  value: MailboxDensity;
  onChange: (density: MailboxDensity) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Inbox density"
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--radius-md)]",
        "border border-border bg-surface-2 p-1 scrollbar-none",
      )}
    >
      {DENSITY_OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-3",
              "rounded-[var(--radius-sm)] text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Account filter. A horizontally scrolling strip rather than a wrapping block:
 * six accounts on a 360px pane used to push the list four rows down the screen
 * before a single message was visible.
 */
function AccountFilterStrip({
  accounts,
  selected,
  onSelect,
  accountAccent,
}: {
  accounts: Array<{ id: string; display_name: string; provider: string }>;
  selected: string;
  onSelect: (id: string) => void;
  accountAccent: (id: string) => Accent;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by account"
      className={cn(
        "scroll-region flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
      )}
    >
      <AccountChip
        label="All"
        active={selected === "all"}
        accent="primary"
        onClick={() => onSelect("all")}
      />
      {accounts.map((account) => (
        <AccountChip
          key={account.id}
          label={account.display_name}
          provider={account.provider}
          active={selected === account.id}
          accent={accountAccent(account.id)}
          onClick={() => onSelect(account.id)}
        />
      ))}
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
      aria-pressed={active}
      className={cn(
        "mailbox-chip inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-3",
        "whitespace-nowrap text-sm font-semibold text-muted-foreground",
        "transition-colors duration-[var(--motion-duration-sm)] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-xs",
        "app:h-9",
        accent === "primary" ? "mailbox-c-primary" : accentClass(accent),
      )}
    >
      {provider ? (
        <ProviderIcon provider={provider} className="h-4 w-4 shrink-0" />
      ) : (
        <Inbox className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
