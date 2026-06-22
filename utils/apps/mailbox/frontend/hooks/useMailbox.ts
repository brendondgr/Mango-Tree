import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import * as api from "@/services/mailboxClient";
import type { MailAccount, MailAccountDraft, MailMessage } from "@/types/mailbox";

export type InboxMessage = MailMessage & { accountId: string };

export const MAILBOX_KEYS = {
  accounts: ["mailbox", "accounts"] as const,
  messages: (accountId: string, folder: string) =>
    ["mailbox", "messages", accountId, folder] as const,
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
 *  are skipped (their reads would deny). */
export function useAccountMessages(
  accounts: MailAccount[],
  folder = "INBOX",
  enabled = true,
) {
  const results = useQueries({
    queries: accounts.map((account) => ({
      queryKey: MAILBOX_KEYS.messages(account.id, folder),
      queryFn: async (): Promise<InboxMessage[]> => {
        const response = await api.listMessages(account.id, folder);
        return response.messages.map((message) => ({ ...message, accountId: account.id }));
      },
      enabled: enabled && account.has_credential,
      retry: 0,
    })),
  });

  const messages = results
    .flatMap((result) => result.data ?? [])
    .sort((a, b) => (a.date < b.date ? 1 : -1));
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
    mutationFn: ({ id, payload }: { id: string; payload: api.CredentialPayload }) =>
      api.setCredential(id, payload),
    onSuccess: invalidate,
  });
}

export function useTestAccount() {
  const invalidate = useAccountsInvalidator();
  return useMutation({
    mutationFn: (id: string) => api.testAccount(id),
    onSuccess: invalidate,
  });
}
