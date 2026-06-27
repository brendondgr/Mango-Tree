// Types for the mailbox API. Shapes mirror docs/api.md under "Mailbox".

export type MailProvider = "gmail" | "m365" | "exchange" | "yahoo";
export type MailAccountStatus = "untested" | "ok" | "error";

export interface MailAccount {
  id: string;
  provider: MailProvider;
  display_name: string;
  email: string;
  enabled: boolean;
  credential_ref: string | null;
  status: MailAccountStatus;
  use_graph: boolean;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  has_credential: boolean;
  color: string | null;
}

// Draft used by the Settings form before an id exists.
export interface MailAccountDraft {
  id?: string;
  provider: MailProvider;
  display_name: string;
  email: string;
  enabled?: boolean;
  use_graph?: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  color?: string | null;
}

export interface MailMessage {
  uid: string;
  message_id: string;
  provider: string;
  account: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number; // epoch seconds parsed from Date; 0 when unparseable
  snippet: string;
  flags: string[];
  unread: boolean;
  body_text: string | null;
  body_html: string | null;
}

export interface ListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
}

export type MailSyncState = "idle" | "syncing" | "error";

export interface MailSyncStatus {
  state: MailSyncState;
  processed: number;
  total: number;
  new: number;
  removed: number;
  error: string | null;
  updated_at: number;
}

export interface MessagesResponse {
  messages: MailMessage[];
  count: number;
  folder: string;
  sync?: MailSyncStatus;
}

export interface TestResult {
  id: string;
  status: MailAccountStatus;
  ok: boolean;
  code?: string;
  message?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export type MailDensity = "compact" | "modern";
