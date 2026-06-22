// API client for the mailbox app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "Mailbox".

import type {
  ApiErrorBody,
  ListResponse,
  MailAccount,
  MailAccountDraft,
  MessagesResponse,
  MailMessage,
  TestResult,
} from "@/types/mailbox";

const UNREACHABLE =
  "Cannot reach the mailbox API. Start the backend with `uv run manage.py runserver`.";

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      code: "internal_error",
      message: response.statusText || "Request failed",
      details: {},
    };
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    const error = await parseError(response);
    throw new Error(error.message || error.code);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const base = "/api/mailbox/accounts";
const id = (value: string) => encodeURIComponent(value);

// --- accounts ---------------------------------------------------------------

export function listAccounts(): Promise<ListResponse<MailAccount>> {
  return request<ListResponse<MailAccount>>(`${base}/?page_size=500`);
}

export function createAccount(account: MailAccountDraft): Promise<MailAccount> {
  return request<MailAccount>(`${base}/`, {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function updateAccount(
  accountId: string,
  account: MailAccountDraft,
): Promise<MailAccount> {
  return request<MailAccount>(`${base}/${id(accountId)}/`, {
    method: "PUT",
    body: JSON.stringify(account),
  });
}

export function deleteAccount(accountId: string): Promise<void> {
  return request<void>(`${base}/${id(accountId)}/`, { method: "DELETE" });
}

export function setCredential(
  accountId: string,
  value: string,
): Promise<{ id: string; credential_ref: string; has_credential: boolean }> {
  return request(`${base}/${id(accountId)}/credential/`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function testAccount(accountId: string): Promise<TestResult> {
  return request<TestResult>(`${base}/${id(accountId)}/test/`, { method: "POST" });
}

// --- messages ---------------------------------------------------------------

export function listMessages(
  accountId: string,
  folder = "INBOX",
  limit = 50,
): Promise<MessagesResponse> {
  const params = new URLSearchParams({ folder, limit: String(limit) });
  return request<MessagesResponse>(`${base}/${id(accountId)}/messages/?${params}`);
}

export function getMessage(
  accountId: string,
  uid: string,
  folder = "INBOX",
): Promise<MailMessage> {
  const params = new URLSearchParams({ folder });
  return request<MailMessage>(`${base}/${id(accountId)}/messages/${id(uid)}/?${params}`);
}
