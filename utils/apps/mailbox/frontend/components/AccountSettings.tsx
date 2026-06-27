import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { startOAuth } from "@/services/mailboxClient";

import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetCredential,
  useTestAccount,
  useUpdateAccount,
} from "@mailbox/hooks/useMailbox";
import { type Accent, accentClass, accentForKey, providerLabel } from "@mailbox/utils/colors";
import type { MailAccount, MailAccountDraft, MailProvider } from "@/types/mailbox";

const PROVIDERS: MailProvider[] = ["gmail", "m365", "exchange", "yahoo"];
const isOAuthProvider = (p: MailProvider) => p === "gmail" || p === "m365";

interface FormState {
  provider: MailProvider;
  display_name: string;
  email: string;
  use_graph: boolean;
  imap_host: string;
  imap_port: string;
  smtp_host: string;
  smtp_port: string;
}

const EMPTY: FormState = {
  provider: "gmail",
  display_name: "",
  email: "",
  use_graph: false,
  imap_host: "",
  imap_port: "",
  smtp_host: "",
  smtp_port: "",
};

function toForm(account: MailAccount): FormState {
  return {
    provider: account.provider,
    display_name: account.display_name,
    email: account.email,
    use_graph: account.use_graph,
    imap_host: account.imap_host ?? "",
    imap_port: account.imap_port ? String(account.imap_port) : "",
    smtp_host: account.smtp_host ?? "",
    smtp_port: account.smtp_port ? String(account.smtp_port) : "",
  };
}

function toDraft(form: FormState): MailAccountDraft {
  return {
    provider: form.provider,
    display_name: form.display_name.trim(),
    email: form.email.trim(),
    use_graph: form.use_graph,
    imap_host: form.imap_host.trim() || null,
    imap_port: form.imap_port ? Number(form.imap_port) : null,
    smtp_host: form.smtp_host.trim() || null,
    smtp_port: form.smtp_port ? Number(form.smtp_port) : null,
  };
}

export function AccountSettings() {
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [credential, setCredential] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateAccount();
  const update = useUpdateAccount();
  const remove = useDeleteAccount();
  const saveCred = useSetCredential();
  const test = useTestAccount();

  const editing = accounts.find((a) => a.id === selectedId) ?? null;
  const isNew = selectedId === "new";
  const isOAuth = isOAuthProvider(form.provider);

  useEffect(() => {
    setError(null);
    setCredential("");
    setConnecting(false);
    if (isNew) {
      setForm(EMPTY);
    } else if (editing) {
      setForm(toForm(editing));
    }
  }, [selectedId, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const accentOf = (id: string, index: number): Accent =>
    (["sky", "mint", "coral", "lavender", "tangerine"] as Accent[])[index % 5] ?? accentForKey(id);

  const onConnect = async (provider: MailProvider) => {
    setError(null);
    setConnecting(true);
    try {
      const { authorize_url } = await startOAuth(provider);
      window.location.assign(authorize_url);
    } catch (err) {
      setError((err as Error).message);
      setConnecting(false);
    }
  };

  const onSave = async () => {
    setError(null);
    const draft = toDraft(form);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, account: draft });
      } else {
        const created = await create.mutateAsync(draft);
        setSelectedId(created.id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onSaveCredential = async () => {
    if (!editing || !credential) return;
    setError(null);
    try {
      await saveCred.mutateAsync({ id: editing.id, value: credential });
      setCredential("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onTest = async () => {
    if (!editing) return;
    setError(null);
    try {
      await test.mutateAsync(editing.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    await remove.mutateAsync(editing.id);
    setSelectedId(null);
  };

  return (
    <div className="mailbox-app flex min-h-0 flex-1 flex-col bg-background lg:flex-row">
      {/* account rail */}
      <aside className="flex shrink-0 flex-col border-b border-border lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Email accounts</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSelectedId("new")}>
            <Plus className="h-4 w-4" /> Add email
          </Button>
        </div>
        <div className="mailbox-scroll max-h-48 overflow-y-auto px-2 pb-2 lg:max-h-none lg:flex-1">
          {accounts.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No accounts yet. Add one to start.</p>
          ) : (
            accounts.map((account, index) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedId(account.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors",
                  selectedId === account.id ? "bg-secondary" : "hover:bg-muted",
                  accentClass(accentOf(account.id, index)),
                )}
              >
                <span className="mailbox-dot" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {account.display_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                </span>
                <StatusDot status={account.status} />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* editor */}
      <div className="mailbox-scroll min-h-0 flex-1 overflow-y-auto">
        {selectedId === null ? (
          <div className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
            Select an account to edit, or add a new email.
          </div>
        ) : (
          <div className="mx-auto w-full max-w-xl space-y-5 p-5 lg:p-7">
            <h3 className="text-base font-semibold text-foreground">
              {isNew ? "Add email account" : `Edit ${editing?.display_name}`}
            </h3>

            {/* provider picker */}
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    disabled={!isNew}
                    onClick={() => {
                      setError(null);
                      setConnecting(false);
                      setForm((f) => ({ ...f, provider }));
                    }}
                    className={cn(
                      "mailbox-chip",
                      form.provider === provider && "mailbox-c-primary",
                      !isNew && "cursor-not-allowed opacity-60",
                    )}
                    data-active={form.provider === provider}
                  >
                    {providerLabel(provider)}
                  </button>
                ))}
              </div>
            </div>

            {isNew && isOAuth ? (
              /* OAuth provider, new account: go straight to the portal */
              <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-card p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  You'll be redirected to {providerLabel(form.provider)} to sign in. We never see
                  your password — only a token that keeps the connection alive.
                </p>
                <Button onClick={() => onConnect(form.provider)} disabled={connecting} className="gap-1.5">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Connect {providerLabel(form.provider)}
                </Button>
              </div>
            ) : (
              <>
                <Field label="Display name">
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="Work, Personal, Team…"
                  />
                </Field>

                <Field label="Email address">
                  <Input
                    type="email"
                    value={form.email}
                    disabled={isOAuth}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </Field>

                {form.provider === "m365" && (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.use_graph}
                      onChange={(e) => setForm((f) => ({ ...f, use_graph: e.target.checked }))}
                    />
                    Use Microsoft Graph (when available)
                  </label>
                )}

                {form.provider === "exchange" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="IMAP host">
                      <Input value={form.imap_host} onChange={(e) => setForm((f) => ({ ...f, imap_host: e.target.value }))} placeholder="mail.corp.com" />
                    </Field>
                    <Field label="IMAP port">
                      <Input value={form.imap_port} onChange={(e) => setForm((f) => ({ ...f, imap_port: e.target.value }))} placeholder="993" />
                    </Field>
                    <Field label="SMTP host">
                      <Input value={form.smtp_host} onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))} placeholder="mail.corp.com" />
                    </Field>
                    <Field label="SMTP port">
                      <Input value={form.smtp_port} onChange={(e) => setForm((f) => ({ ...f, smtp_port: e.target.value }))} placeholder="587" />
                    </Field>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* OAuth new accounts are created by the portal callback, not here */}
                  {!(isNew && isOAuth) && (
                    <Button onClick={onSave} disabled={create.isPending || update.isPending}>
                      {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isNew ? "Create account" : "Save changes"}
                    </Button>
                  )}
                  {editing && isOAuth && (
                    <Button variant="outline" onClick={() => onConnect(editing.provider)} disabled={connecting} className="gap-1.5">
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Reconnect
                    </Button>
                  )}
                  {editing && (
                    <Button variant="outline" onClick={onTest} disabled={test.isPending}>
                      {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Test connection
                    </Button>
                  )}
                  {editing && (
                    <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={onDelete}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                </div>

                {test.data && (
                  <p className={cn("flex items-center gap-1.5 text-sm", test.data.ok ? "text-[hsl(var(--success))]" : "text-destructive")}>
                    {test.data.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {test.data.ok ? "Connection OK" : test.data.message ?? "Connection failed"}
                  </p>
                )}

                {/* credential / connection status */}
                {editing && isOAuth ? (
                  <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card p-4">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Connected via {providerLabel(editing.provider)}. Access tokens refresh
                      automatically; use Reconnect if sign-in expires.
                    </span>
                    {editing.has_credential && <span className="mailbox-badge mailbox-c-mint ml-auto">Linked</span>}
                  </div>
                ) : editing ? (
                  <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">App password</span>
                      {editing.has_credential && <span className="mailbox-badge mailbox-c-mint ml-auto">Stored</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input type="password" value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="App password" />
                      <Button onClick={onSaveCredential} disabled={!credential || saveCred.isPending}>
                        {saveCred.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Stored separately in a private <code>0600</code> file — never written to the
                      account config, never shown again.
                    </p>
                  </div>
                ) : null}
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: MailAccount["status"] }) {
  return (
    <span
      className={cn(
        "mailbox-status",
        status === "ok" && "mailbox-status-ok",
        status === "error" && "mailbox-status-error",
        status === "untested" && "mailbox-status-untested",
      )}
      title={status}
      aria-label={`status: ${status}`}
    />
  );
}
