import { useEffect } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import * as api from "@/services/mailboxClient";
import type { MailAccount, MailAccountDraft, MailMessage } from "@/types/mailbox";

export type InboxMessage = MailMessage & { accountId: string };

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

/** Fetch messages for several accounts at once and merge (newest first). Each
 *  message is tagged with its `accountId`. Accounts without a stored credential
 *  are skipped (their reads would deny). ``limit`` defaults to "all" so the
 *  inbox shows every message; pass a number to cap the count per account. */
export function useAccountMessages(
  accounts: MailAccount[],
  folder = "INBOX",
  enabled = true,
  limit: number | "all" = "all",
) {
  const results = useQueries({
    queries: accounts.map((account) => ({
      queryKey: MAILBOX_KEYS.messages(account.id, folder, limit),
      queryFn: async (): Promise<InboxMessage[]> => {
        const response = await api.listMessages(account.id, folder, limit);
        return response.messages.map((message) => ({ ...message, accountId: account.id }));
      },
      enabled: enabled && account.has_credential,
      retry: 0,
    })),
  });

  // Newest first by parsed timestamp; fall back to the raw date string only
  // when both timestamps are missing (0), so chronological order is correct
  // even when accounts use different Date header formats.
  const messages = results
    .flatMap((result) => result.data ?? [])
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      return a.date < b.date ? 1 : -1;
    });
  const isLoading = results.some((result) => result.isLoading && result.fetchStatus !== "idle");
  const errorCount = results.filter((result) => result.isError).length;

  return { messages, isLoading, errorCount };
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
  const openMailboxTab = useWorkspaceStore((s) => s.openMailboxTab);
  const setMailboxView = useWorkspaceStore((s) => s.setMailboxView);
  const setMailboxAccountId = useWorkspaceStore((s) => s.setMailboxAccountId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("mailbox_added");
    const error = params.get("mailbox_error");
    if (!added && !error) return;

    openMailboxTab();
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
