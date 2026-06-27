import { useEffect } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import * as api from "@/services/mailboxClient";
import type {
  MailAccount,
  MailAccountDraft,
  MailMessage,
  MailSyncStatus,
} from "@/types/mailbox";

export type InboxMessage = MailMessage & { accountId: string };

export interface InboxSyncSummary {
  isSyncing: boolean;
  processed: number;
  total: number;
  newCount: number;
  error: string | null;
}

export const MAILBOX_KEYS = {
  accounts: ["mailbox", "accounts"] as const,
  messages: (accountId: string, folder: string, limit: number | "all") =>
    ["mailbox", "messages", accountId, folder, String(limit)] as const,
  message: (accountId: string, uid: string, folder: string) =>
    ["mailbox", "message", accountId, uid, folder] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: MAILBOX_KEYS.accounts,
    queryFn: async () => (await api.listAccounts()).results,
  });
}

interface AccountMessages {
  messages: InboxMessage[];
  sync: MailSyncStatus | null;
}

/** Read the cached messages for several accounts at once and merge (newest
 *  first). Reads are served from the local cache (no network); call
 *  {@link useMailboxAutoSync} to keep the cache fresh. While an account is
 *  syncing, its query polls faster so the list and progress update live. */
export function useAccountMessages(
  accounts: MailAccount[],
  folder = "INBOX",
  enabled = true,
  limit: number | "all" = "all",
) {
  const results = useQueries({
    queries: accounts.map((account) => ({
      queryKey: MAILBOX_KEYS.messages(account.id, folder, limit),
      queryFn: async (): Promise<AccountMessages> => {
        const response = await api.listMessages(account.id, folder, limit);
        return {
          messages: response.messages.map((message) => ({ ...message, accountId: account.id })),
          sync: response.sync ?? null,
        };
      },
      enabled: enabled && account.has_credential,
      retry: 0,
      // poll fast while that account is syncing (list fills + progress), else
      // slowly to pick up results from the 10s auto-sync triggers.
      refetchInterval: (query: { state: { data?: AccountMessages } }) => {
        if (!enabled) return false;
        return query.state.data?.sync?.state === "syncing" ? 1500 : 8000;
      },
    })),
  });

  // Newest first by parsed timestamp; fall back to the raw date string only
  // when both timestamps are missing (0), so chronological order is correct
  // even when accounts use different Date header formats.
  const messages = results
    .flatMap((result) => result.data?.messages ?? [])
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      return a.date < b.date ? 1 : -1;
    });
  const isLoading = results.some((result) => result.isLoading && result.fetchStatus !== "idle");
  const errorCount = results.filter((result) => result.isError).length;

  const syncs = results
    .map((result) => result.data?.sync)
    .filter((s): s is MailSyncStatus => Boolean(s));
  const sync: InboxSyncSummary = {
    isSyncing: syncs.some((s) => s.state === "syncing"),
    processed: syncs.reduce((n, s) => n + (s.state === "syncing" ? s.processed : 0), 0),
    total: syncs.reduce((n, s) => n + (s.state === "syncing" ? s.total : 0), 0),
    newCount: syncs.reduce((n, s) => n + s.new, 0),
    error: syncs.find((s) => s.state === "error")?.error ?? null,
  };

  return { messages, isLoading, errorCount, sync };
}

/** Keep the local cache fresh: trigger an incremental background sync for each
 *  credentialed account on mount and every `intervalMs` (default 10s). Only
 *  runs while mounted (i.e. while the inbox is open). Fire-and-forget — results
 *  surface through {@link useAccountMessages}'s polling. */
export function useMailboxAutoSync(
  accounts: MailAccount[],
  folder = "INBOX",
  enabled = true,
  intervalMs = 10000,
) {
  const ids = accounts
    .filter((a) => a.has_credential)
    .map((a) => a.id)
    .join(",");
  useEffect(() => {
    if (!enabled || !ids) return undefined;
    const list = ids.split(",");
    const run = () => {
      for (const accountId of list) void api.syncAccount(accountId, folder).catch(() => {});
    };
    run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }, [ids, folder, enabled, intervalMs]);
}

export function useMessage(
  accountId: string,
  uid: string | null,
  folder = "INBOX",
  enabled = true,
) {
  return useQuery({
    queryKey: MAILBOX_KEYS.message(accountId, uid ?? "", folder),
    queryFn: () => api.getMessage(accountId, uid as string, folder),
    enabled: enabled && Boolean(uid),
  });
}

// --- mutations --------------------------------------------------------------

function useAccountsInvalidator() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MAILBOX_KEYS.accounts });
}

export function useCreateAccount() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: (account: MailAccountDraft) => api.createAccount(account),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: ({ id, account }: { id: string; account: MailAccountDraft }) =>
      api.updateAccount(id, account),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: invalidate,
  });
}

export function useSetCredential() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api.setCredential(id, value),
    onSuccess: invalidate,
  });
}

/** When the OAuth callback bounces the browser back with ?mailbox_added /
 *  ?mailbox_error, open the Mailbox Settings tab, select the new account, and
 *  clean the URL. Mount once in an always-rendered workspace component. */
export function useOAuthReturn() {
  const qc = useQueryClient();
  const openAppTab = useWorkspaceStore((s) => s.openAppTab);
  const setMailboxView = useWorkspaceStore((s) => s.setMailboxView);
  const setMailboxAccountId = useWorkspaceStore((s) => s.setMailboxAccountId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("mailbox_added");
    const error = params.get("mailbox_error");
    if (!added && !error) return;

    openAppTab("mailbox");
    setMailboxView("settings");
    if (added) {
      setMailboxAccountId(added);
      qc.invalidateQueries({ queryKey: MAILBOX_KEYS.accounts });
    }
    params.delete("mailbox_added");
    params.delete("mailbox_error");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useTestAccount() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: (id: string) => api.testAccount(id),
    onSuccess: invalidate,
  });
}
