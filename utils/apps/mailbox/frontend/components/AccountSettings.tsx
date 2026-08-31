import { useEffect, useId, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { AppHeader } from "@/components/app-shell/AppHeader";
import { MasterDetail } from "@/components/app-shell/MasterDetail";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { startOAuth } from "@/services/mailboxClient";

import { MailboxNav } from "@mailbox/components/MailboxNav";
import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetCredential,
  useTestAccount,
  useUpdateAccount,
} from "@mailbox/hooks/useMailbox";
import {
  ACCENTS,
  type Accent,
  accentClass,
  accentForAccount,
  providerLabel,
} from "@mailbox/utils/colors";
import type { MailAccount, MailAccountDraft, MailProvider } from "@/types/mailbox";

const PROVIDERS: MailProvider[] = ["gmail", "m365", "exchange", "yahoo"];
const isOAuthProvider = (p: MailProvider) => p === "gmail" || p === "m365";

const SCROLLBAR = "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60";

interface FormState {
  provider: MailProvider;
  display_name: string;
  email: string;
  use_graph: boolean;
  imap_host: string;
  imap_port: string;
  smtp_host: string;
  smtp_port: string;
  color: Accent | null;
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
  color: null,
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
    color: (account.color as Accent) ?? null,
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
    color: form.color,
  };
}

/**
 * Account list beside account editor.
 *
 * The rail used to be a `lg:w-72` column pinned next to the form inside an
 * `overflow-hidden` pane, which on a phone left the form a sliver of what was
 * already too little. `MasterDetail` makes it one column at a time below 720px
 * of PANE — the width the user actually controls by dragging the chat sidebar.
 */
export function AccountSettings() {
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [credential, setCredential] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useGraphId = useId();

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
    setError(null);
    try {
      await remove.mutateAsync(editing.id);
      setSelectedId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const list = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">Accounts</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSelectedId("new")}>
          <Plus className="h-4 w-4" /> Add email
        </Button>
      </div>
      <AsyncBoundary
        loading={accountsQuery.isLoading}
        error={accountsQuery.error}
        empty={accounts.length === 0}
        onRetry={() => void accountsQuery.refetch()}
        label="your accounts"
        skeleton={<SkeletonList count={3} className="px-3" />}
        emptyIcon={Mail}
        emptyTitle="No accounts yet"
        emptyDescription="Add an email account to start reading mail in the inbox."
        emptyAction={
          <Button size="sm" className="gap-1.5" onClick={() => setSelectedId("new")}>
            <Plus className="h-4 w-4" /> Add email
          </Button>
        }
        className={cn("min-h-0 flex-1 overflow-y-auto p-2", SCROLLBAR)}
      >
        <ul className="space-y-0.5">
          {accounts.map((account, index) => (
            <li key={account.id} data-enter style={{ "--i": index } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setSelectedId(account.id)}
                aria-current={selectedId === account.id ? "true" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedId === account.id ? "bg-secondary" : "hover:bg-muted",
                  accentClass(accentForAccount(account)),
                )}
              >
                <span
                  className="mailbox-provider inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)]"
                  aria-hidden
                >
                  <ProviderIcon provider={account.provider} className="mailbox-provider-glyph" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {account.display_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                <StatusDot status={account.status} />
              </button>
            </li>
          ))}
        </ul>
      </AsyncBoundary>
    </div>
  );

  const detail =
    selectedId === null ? (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          icon={SettingsIcon}
          title="No account selected"
          description="Pick an account to edit, or add a new email address."
          action={
            <Button className="gap-1.5" onClick={() => setSelectedId("new")}>
              <Plus className="h-4 w-4" /> Add email
            </Button>
          }
        />
      </div>
    ) : (
      // The form column is its own query container. `@[45rem]` and `@[26rem]`
      // below would otherwise resolve against the workspace root — a whole list
      // column wider than the form they are meant to be sizing.
      <div
        className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLBAR)}
        style={{ containerType: "inline-size" }}
      >
        <div className="mx-auto w-full max-w-xl space-y-5 p-4 @[45rem]:p-7">
          <h3 className="text-base font-semibold text-foreground">
            {isNew ? "Add email account" : `Edit ${editing?.display_name}`}
          </h3>

          <ProviderField
            value={form.provider}
            disabled={!isNew}
            onChange={(provider) => {
              setError(null);
              setConnecting(false);
              setForm((f) => ({ ...f, provider }));
            }}
          />

          {isNew && isOAuth ? (
            /* OAuth provider, new account: go straight to the portal */
            <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">
                You'll be redirected to {providerLabel(form.provider)} to sign in. We never see
                your password — only a token that keeps the connection alive.
              </p>
              <Button
                onClick={() => onConnect(form.provider)}
                disabled={connecting}
                className="gap-1.5"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
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

              <ColorPicker
                value={form.color}
                onChange={(color) => setForm((f) => ({ ...f, color }))}
              />

              <Field
                label="Email address"
                hint={isOAuth ? "Set by the provider when you signed in." : undefined}
              >
                <Input
                  type="email"
                  value={form.email}
                  disabled={isOAuth}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                />
              </Field>

              {form.provider === "m365" && (
                <div className="flex min-h-11 items-center justify-between gap-3 app:min-h-9">
                  <Label htmlFor={useGraphId} className="cursor-pointer font-normal">
                    Use Microsoft Graph (when available)
                  </Label>
                  <Switch
                    id={useGraphId}
                    checked={form.use_graph}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, use_graph: v }))}
                    className="h-6 w-10"
                  />
                </div>
              )}

              {form.provider === "exchange" && (
                <div className="grid grid-cols-1 gap-3 @[26rem]:grid-cols-2">
                  <Field label="IMAP host">
                    <Input
                      value={form.imap_host}
                      onChange={(e) => setForm((f) => ({ ...f, imap_host: e.target.value }))}
                      placeholder="mail.corp.com"
                    />
                  </Field>
                  <Field label="IMAP port">
                    <Input
                      inputMode="numeric"
                      value={form.imap_port}
                      onChange={(e) => setForm((f) => ({ ...f, imap_port: e.target.value }))}
                      placeholder="993"
                    />
                  </Field>
                  <Field label="SMTP host">
                    <Input
                      value={form.smtp_host}
                      onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
                      placeholder="mail.corp.com"
                    />
                  </Field>
                  <Field label="SMTP port">
                    <Input
                      inputMode="numeric"
                      value={form.smtp_port}
                      onChange={(e) => setForm((f) => ({ ...f, smtp_port: e.target.value }))}
                      placeholder="587"
                    />
                  </Field>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {/* OAuth new accounts are created by the portal callback, not here */}
                {!(isNew && isOAuth) && (
                  <Button onClick={onSave} disabled={create.isPending || update.isPending}>
                    {(create.isPending || update.isPending) && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isNew ? "Create account" : "Save changes"}
                  </Button>
                )}
                {editing && isOAuth && (
                  <Button
                    variant="outline"
                    onClick={() => onConnect(editing.provider)}
                    disabled={connecting}
                    className="gap-1.5"
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Reconnect
                  </Button>
                )}
                {editing && (
                  <Button variant="outline" onClick={onTest} disabled={test.isPending}>
                    {test.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Test connection
                  </Button>
                )}
                {editing && (
                  /* Deleting takes the account AND its stored credential, and
                     nothing here can put either back — so it asks first. */
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="ml-auto gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {editing.display_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the account and the credential stored for it. Mail on
                          the server is untouched, but you will have to add {editing.email}{" "}
                          again and sign in before it can be read here. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void onDelete()}
                          disabled={remove.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {remove.isPending ? "Deleting…" : "Delete account"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {test.data && (
                <p
                  role="status"
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    test.data.ok ? "text-[hsl(var(--success))]" : "text-destructive",
                  )}
                >
                  {test.data.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {test.data.ok ? "Connection OK" : test.data.message ?? "Connection failed"}
                </p>
              )}

              {/* credential / connection status */}
              {editing && isOAuth ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card p-4">
                  <KeyRound className="h-4 w-4 shrink-0 text-primary-emphasis" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                    Connected via {providerLabel(editing.provider)}. Access tokens refresh
                    automatically; use Reconnect if sign-in expires.
                  </span>
                  {editing.has_credential && <Pill accent="mint">Linked</Pill>}
                </div>
              ) : editing ? (
                <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 shrink-0 text-primary-emphasis" aria-hidden />
                    <span className="text-sm font-medium text-foreground">App password</span>
                    {editing.has_credential && (
                      <span className="ml-auto">
                        <Pill accent="mint">Stored</Pill>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field
                      label="App password"
                      hideLabel
                      className="min-w-[12rem] flex-1"
                      hint="Stored separately in a private 0600 file — never written to the account config, never shown again."
                    >
                      <Input
                        type="password"
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        placeholder="App password"
                      />
                    </Field>
                    <Button
                      onClick={onSaveCredential}
                      disabled={!credential || saveCred.isPending}
                      className="shrink-0"
                    >
                      {saveCred.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <AppHeader
        icon={SettingsIcon}
        title="Mailbox"
        description={`${accounts.length} account${accounts.length === 1 ? "" : "s"} connected`}
        nav={<MailboxNav />}
      />
      <MasterDetail
        list={list}
        detail={detail}
        selected={selectedId !== null}
        onBack={() => setSelectedId(null)}
        detailTitle={isNew ? "Add email account" : editing?.display_name}
        listWidth="19rem"
      />
    </div>
  );
}

/**
 * Provider picker.
 *
 * Was four chip buttons with `data-active` and no grouping semantics, which on
 * a narrow pane wrapped to three rows above a form that had none left. A Select
 * is one control, one tab stop, and comes with typeahead. It is labelled by id
 * rather than wrapped in `Field`, because `Field` clones its child and the child
 * of a Radix Select is the Root, not the button.
 */
function ProviderField({
  value,
  disabled,
  onChange,
}: {
  value: MailProvider;
  disabled: boolean;
  onChange: (provider: MailProvider) => void;
}) {
  const labelId = useId();
  const triggerId = useId();
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId} htmlFor={triggerId}>
        Provider
      </Label>
      {disabled && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          The provider cannot be changed after an account is created.
        </p>
      )}
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as MailProvider)}
      >
        <SelectTrigger
          id={triggerId}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={disabled ? hintId : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((provider) => (
            <SelectItem key={provider} value={provider}>
              <span className="flex items-center gap-2">
                <ProviderIcon provider={provider} className="h-4 w-4 shrink-0" />
                {providerLabel(provider)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Inbox colour. Toggle buttons rather than a radio group: the accent is
 * clearable (back to "Auto"), and each swatch is a 44px target on compact so it
 * can actually be hit with a thumb — the old 28px circles could not.
 */
function ColorPicker({
  value,
  onChange,
}: {
  value: Accent | null;
  onChange: (accent: Accent | null) => void;
}) {
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Inbox color</Label>
      <p className="text-xs text-muted-foreground">
        Tints this account everywhere it appears. Auto derives one from the account id.
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            "inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-border px-3",
            "text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "aria-pressed:border-primary aria-pressed:text-foreground app:h-8",
          )}
        >
          Auto
        </button>
        {ACCENTS.map((accent) => (
          <button
            key={accent}
            type="button"
            onClick={() => onChange(value === accent ? null : accent)}
            aria-pressed={value === accent}
            aria-label={accent}
            title={accent}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-pill)] app:h-8 app:w-8",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              accentClass(accent),
            )}
          >
            <span
              className={cn(
                "mailbox-swatch block rounded-[var(--radius-pill)] transition-[width,height]",
                "duration-[var(--motion-duration-sm)]",
                value === accent ? "h-7 w-7 ring-2 ring-foreground/70 app:h-6 app:w-6" : "h-5 w-5",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "mailbox-badge inline-flex shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-px",
        "text-[0.66rem] font-bold uppercase tracking-wide",
        accentClass(accent),
      )}
    >
      {children}
    </span>
  );
}

function StatusDot({ status }: { status: MailAccount["status"] }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-[var(--radius-pill)]",
        status === "ok" && "bg-[hsl(var(--success))]",
        status === "error" && "bg-destructive",
        status === "untested" && "bg-muted-foreground",
      )}
      title={status}
      aria-label={`status: ${status}`}
      role="img"
    />
  );
}
