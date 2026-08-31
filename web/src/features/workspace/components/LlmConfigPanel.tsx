import {
  AlertTriangle,
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, useFormErrors } from "@/components/ui/field";
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
import {
  createProvider,
  deleteProvider,
  discoverModels,
  listProviderKinds,
  listProviders,
  testProvider,
  updateProvider,
  type DiscoveredModel,
  type LlmProvider,
  type ModelDiscovery,
  type ProviderKind,
  type ProviderPatch,
  type ProviderTestResult,
  type ProviderWrite,
} from "@/services/llmProviders";
import { cn } from "@/lib/utils";

/**
 * The provider manager.
 *
 * This panel used to be four raw text fields, one of which was an API key that
 * went straight into localStorage and back out on every chat turn. It is now a
 * front end for `/api/llm/`: the server owns the providers and the keys, and
 * the browser holds nothing but a pointer at one of them.
 *
 * Three rules shape the UI:
 *
 * 1. **A key is write-only.** Nothing here ever puts a key into an input's
 *    `value`; the only key state shown is `key_hint`, a masked tail. Because an
 *    omitted `api_key` means "leave it alone" and an explicit `""` means
 *    "clear", a blank field would be ambiguous — so removing a key is its own
 *    deliberate control rather than an empty box.
 * 2. **Unreachable is not broken.** A local server that is switched off is the
 *    normal state of a laptop, so discovery failure renders as a message beside
 *    the dropdown, never as an error screen over the whole panel.
 * 3. **Say it now, not at send time.** If the saved model has disappeared from
 *    the provider, the panel falls back and *says so* here, rather than letting
 *    the next chat turn fail with a 404 from the model endpoint.
 */

interface LlmConfigPanelProps {
  active?: boolean;
}

const CARD_CLASS =
  "rounded-[var(--radius-md)] border border-border bg-surface-1 p-3";

const SECTION_CLASS =
  "grid gap-3 rounded-[var(--radius-md)] border border-border p-3 app:p-4";

// --- small presentational helpers -------------------------------------------

type Severity = "success" | "warning" | "error" | "info";

const SEVERITY_STYLE: Record<
  Severity,
  { text: string; icon: typeof CheckCircle2 }
> = {
  success: { text: "text-success", icon: CheckCircle2 },
  warning: { text: "text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  error: { text: "text-destructive", icon: XCircle },
  info: { text: "text-muted-foreground", icon: Info },
};

/** One line of outcome: an icon so the state is not colour alone, then text. */
function StatusLine({
  severity,
  title,
  detail,
}: {
  severity: Severity;
  title: string;
  detail?: string;
}) {
  const { text, icon: Icon } = SEVERITY_STYLE[severity];
  return (
    <div className={cn("flex items-start gap-2 text-sm", text)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium leading-snug">{title}</p>
        {detail && (
          <p className="break-words text-xs leading-snug opacity-90">{detail}</p>
        )}
      </div>
    </div>
  );
}

function keyStateLabel(provider: LlmProvider): {
  severity: Severity;
  label: string;
} {
  if (provider.key_hint) {
    return { severity: "success", label: `Key set · ${provider.key_hint}` };
  }
  if (provider.has_key) return { severity: "success", label: "Key set" };
  if (provider.needs_key) {
    return { severity: "warning", label: "No key — this kind needs one" };
  }
  return { severity: "info", label: "No key needed" };
}

function formatContext(tokens: number | null): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k context`;
  return `${tokens} context`;
}

// --- provider row ------------------------------------------------------------

function ProviderRow({
  provider,
  selected,
  busy,
  onSelect,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  provider: LlmProvider;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const inputId = `llm-provider-${provider.slug}`;
  const key = keyStateLabel(provider);
  const KeyIcon = SEVERITY_STYLE[key.severity].icon;

  return (
    <div
      className={cn(
        CARD_CLASS,
        "flex items-start gap-2.5 transition-colors",
        selected && "border-primary bg-surface-2",
        !provider.enabled && "opacity-70",
      )}
    >
      <input
        type="radio"
        id={inputId}
        name="llm-active-provider"
        className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        checked={selected}
        onChange={onSelect}
      />

      {/* The label is the hit area for selection; the action buttons sit
          outside it, because a button inside a <label> would also toggle it. */}
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{provider.label}</span>
          <Badge variant="muted">{provider.kind_label}</Badge>
          {!provider.editable && (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden />
              config
            </Badge>
          )}
          {!provider.enabled && <Badge variant="outline">disabled</Badge>}
        </span>

        <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
          {provider.base_url || "built-in endpoint"}
        </span>

        <span
          className={cn(
            "mt-1 flex items-center gap-1.5 text-xs",
            SEVERITY_STYLE[key.severity].text,
          )}
        >
          <KeyIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{key.label}</span>
        </span>

        {provider.default_model && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            Default model: {provider.default_model}
          </span>
        )}
      </label>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {provider.editable ? (
          <>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label={`Edit ${provider.label}`}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete ${provider.label}`}
              >
                <Trash2 />
              </Button>
            </div>
            <Switch
              checked={provider.enabled}
              disabled={busy}
              onCheckedChange={onToggleEnabled}
              aria-label={`Enable ${provider.label}`}
            />
          </>
        ) : (
          <span className="max-w-[7rem] text-right text-[0.6875rem] leading-tight text-muted-foreground">
            Declared in config/models.yaml
          </span>
        )}
      </div>
    </div>
  );
}

// --- add / edit dialog -------------------------------------------------------

type FormField =
  | "slug"
  | "label"
  | "kind"
  | "base_url"
  | "default_model"
  | "api_key"
  | "api_key_env"
  | "connect_timeout"
  | "timeout";

interface FormDraft {
  slug: string;
  label: string;
  kind: string;
  base_url: string;
  default_model: string;
  apiKey: string;
  api_key_env: string;
  connect_timeout: string;
  timeout: string;
  enabled: boolean;
  removeKey: boolean;
}

function emptyDraft(): FormDraft {
  return {
    slug: "",
    label: "",
    // Filled in once the kind list arrives; see the effect below.
    kind: "",
    base_url: "",
    default_model: "",
    apiKey: "",
    api_key_env: "",
    connect_timeout: "",
    timeout: "",
    enabled: true,
    removeKey: false,
  };
}

function draftFrom(provider: LlmProvider): FormDraft {
  return {
    slug: provider.slug,
    label: provider.label,
    kind: provider.kind,
    base_url: provider.base_url,
    default_model: provider.default_model,
    // Never seeded from the server — a key is not readable, and an input whose
    // value looked like a key would invite the user to "keep" a fiction.
    apiKey: "",
    api_key_env: "",
    connect_timeout: String(provider.connect_timeout ?? ""),
    timeout: String(provider.timeout ?? ""),
    enabled: provider.enabled,
    removeKey: false,
  };
}

function ProviderFormDialog({
  kindsError,
  open,
  onOpenChange,
  kinds,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kinds: ProviderKind[];
  /** Set when the kind list could not be loaded, which blocks the form. */
  kindsError?: string | null;
  /** Present when editing; absent when adding. */
  provider: LlmProvider | null;
  onSaved: (saved: LlmProvider, created: boolean) => void;
}) {
  const editing = provider !== null;
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { errors, formError, setFieldError, setFormError, clear, focusFirstError } =
    useFormErrors<FormField>();

  useEffect(() => {
    if (!open) return;
    setDraft(provider ? draftFrom(provider) : emptyDraft());
    setSaving(false);
    clear();
  }, [open, provider, clear]);

  // Seed the kind only while it is still unset, so a kind list that resolves
  // after the dialog opened cannot overwrite a choice the user already made.
  useEffect(() => {
    if (kinds.length === 0) return;
    setDraft((current) =>
      current.kind ? current : { ...current, kind: kinds[0].id },
    );
  }, [kinds]);

  const kind = useMemo(
    () => kinds.find((entry) => entry.id === draft.kind) ?? null,
    [kinds, draft.kind],
  );
  const needsBaseUrl = kind?.needs_base_url ?? true;
  const needsKey = kind?.needs_key ?? false;

  const update = <K extends keyof FormDraft>(field: K, value: FormDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const parseTimeout = (
    raw: string,
    field: "connect_timeout" | "timeout",
    minimum: number,
  ): number | null | "invalid" => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < minimum) {
      setFieldError(field, `Must be a number of at least ${minimum} seconds.`);
      return "invalid";
    }
    return value;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clear();

    let invalid = false;
    if (!editing && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(draft.slug.trim().toLowerCase())) {
      setFieldError(
        "slug",
        "Lowercase letters, numbers and hyphens only, starting with a letter or number.",
      );
      invalid = true;
    }
    if (!draft.kind) {
      setFieldError("kind", "Choose a provider kind.");
      invalid = true;
    }
    if (needsBaseUrl && !draft.base_url.trim()) {
      setFieldError("base_url", "This kind needs a base URL.");
      invalid = true;
    }

    const connect = parseTimeout(draft.connect_timeout, "connect_timeout", 0.5);
    const timeout = parseTimeout(draft.timeout, "timeout", 1);
    if (connect === "invalid" || timeout === "invalid") invalid = true;

    if (invalid) {
      // Focus the first bad control: an error a keyboard user has to hunt for
      // is barely an error message at all.
      window.requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }

    const body: ProviderPatch = {
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      base_url: draft.base_url.trim(),
      default_model: draft.default_model.trim(),
      enabled: draft.enabled,
      ...(connect !== null ? { connect_timeout: connect as number } : {}),
      ...(timeout !== null ? { timeout: timeout as number } : {}),
      ...(draft.api_key_env.trim() ? { api_key_env: draft.api_key_env.trim() } : {}),
    };

    // The key is the one field with three-way semantics: send it when typed,
    // send "" only when the user explicitly asked to remove it, and otherwise
    // omit it entirely so the stored key survives an unrelated edit.
    if (draft.apiKey.trim()) {
      body.api_key = draft.apiKey.trim();
    } else if (draft.removeKey) {
      body.api_key = "";
    }

    setSaving(true);
    try {
      const saved = editing
        ? await updateProvider(provider.slug, body)
        : await createProvider({
            ...body,
            slug: draft.slug.trim().toLowerCase(),
            kind: draft.kind,
          } as ProviderWrite);
      onSaved(saved, !editing);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the provider.";
      const field = (error as { field?: string }).field;
      if (field && ["slug", "kind", "base_url", "connect_timeout", "timeout"].includes(field)) {
        setFieldError(field as FormField, message);
        window.requestAnimationFrame(() => focusFirstError(formRef.current));
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${provider.label}` : "Add a provider"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes apply the next time a model is called."
              : "Point the workspace at another server or hosted API."}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="contents">
          <DialogBody className="grid gap-4">
            {editing ? (
              <div className="space-y-1.5">
                <Label>Id</Label>
                <p className="font-mono text-sm text-muted-foreground">
                  {provider.slug}
                </p>
              </div>
            ) : (
              <Field
                label="Id"
                required
                hint="Used in the API and in config. Lowercase, no spaces."
                error={errors.slug}
              >
                <Input
                  value={draft.slug}
                  onChange={(e) => update("slug", e.target.value)}
                  placeholder="workshop-box"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            )}

            <Field label="Name" hint="Shown in this list. Defaults to the id.">
              <Input
                value={draft.label}
                onChange={(e) => update("label", e.target.value)}
                placeholder="Workshop box"
                autoComplete="off"
              />
            </Field>

            <div className="space-y-1.5">
              <Label htmlFor="llm-form-kind">Kind</Label>
              <Select
                value={draft.kind || undefined}
                onValueChange={(value) => update("kind", value)}
              >
                <SelectTrigger
                  id="llm-form-kind"
                  aria-invalid={errors.kind ? true : undefined}
                  aria-describedby={errors.kind ? "llm-form-kind-error" : undefined}
                  className={
                    errors.kind
                      ? "border-destructive focus-visible:ring-destructive"
                      : undefined
                  }
                >
                  <SelectValue placeholder="Choose a kind" />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.kind && (
                <p
                  id="llm-form-kind-error"
                  role="alert"
                  className="text-xs font-medium text-destructive"
                >
                  {errors.kind}
                </p>
              )}
              {kindsError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {kindsError} Adding a provider needs this list — try reopening
                  settings.
                </p>
              )}
              {kind && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {kind.needs_base_url
                    ? "Runs somewhere you host, so it needs a base URL."
                    : "Hosted API — the endpoint is built in; it needs a key."}
                </p>
              )}
            </div>

            {needsBaseUrl && (
              <Field
                label="Base URL"
                required
                error={errors.base_url}
                hint="Where the server answers, including any /v1 suffix."
              >
                <Input
                  value={draft.base_url}
                  onChange={(e) => update("base_url", e.target.value)}
                  placeholder="http://localhost:9090/v1"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            )}

            <Field
              label="API key"
              hint={
                editing && provider.has_key
                  ? `A key is stored (${provider.key_hint || "hidden"}). Leave blank to keep it.`
                  : needsKey
                    ? "Stored on the server. It is never sent back to this browser."
                    : "Optional — most local servers ignore it."
              }
            >
              <Input
                type="password"
                // Always the local draft, never a value from the server: the
                // API does not return keys and this input must not pretend it
                // does.
                value={draft.apiKey}
                onChange={(e) => {
                  update("apiKey", e.target.value);
                  if (e.target.value) update("removeKey", false);
                }}
                placeholder={
                  editing && provider.has_key ? "•••••• (unchanged)" : "sk-…"
                }
                autoComplete="off"
              />
            </Field>

            {editing && provider.has_key && (
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-border p-2.5">
                <KeyRound
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {draft.removeKey
                    ? "The stored key will be deleted when you save."
                    : "The stored key stays unless you remove it."}
                </span>
                <Button
                  type="button"
                  variant={draft.removeKey ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    update("removeKey", !draft.removeKey);
                    if (!draft.removeKey) update("apiKey", "");
                  }}
                >
                  {draft.removeKey ? "Keep key" : "Remove key"}
                </Button>
              </div>
            )}

            <Field
              label="Key environment variable"
              hint="Optional. Read from the server's environment instead of storing a key here."
            >
              <Input
                value={draft.api_key_env}
                onChange={(e) => update("api_key_env", e.target.value)}
                placeholder="OPENAI_API_KEY"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <Field
              label="Default model"
              hint="Optional. Used when nothing else is chosen."
            >
              <Input
                value={draft.default_model}
                onChange={(e) => update("default_model", e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <div className="grid gap-4 app:grid-cols-2">
              <Field
                label="Connect timeout (s)"
                error={errors.connect_timeout}
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  step={0.5}
                  value={draft.connect_timeout}
                  onChange={(e) => update("connect_timeout", e.target.value)}
                  placeholder="5"
                />
              </Field>
              <Field label="Request timeout (s)" error={errors.timeout}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  value={draft.timeout}
                  onChange={(e) => update("timeout", e.target.value)}
                  placeholder="60"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="llm-form-enabled">Enabled</Label>
              <Switch
                id="llm-form-enabled"
                checked={draft.enabled}
                onCheckedChange={(value) => update("enabled", value)}
              />
            </div>

            {formError && (
              <StatusLine
                severity="error"
                title="Could not save"
                detail={formError}
              />
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Add provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- delete confirmation -----------------------------------------------------

function DeleteProviderDialog({
  provider,
  onOpenChange,
  onConfirm,
  busy,
}: {
  provider: LlmProvider | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {provider?.label}?</DialogTitle>
          <DialogDescription>
            Its stored key is deleted with it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- panel -------------------------------------------------------------------

export function LlmConfigPanel({ active = true }: LlmConfigPanelProps) {
  const selection = useLlmConfigStore((s) => s.selection);
  const setSelection = useLlmConfigStore((s) => s.setSelection);
  const setResolved = useLlmConfigStore((s) => s.setResolved);

  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<string | null>(null);
  const [kinds, setKinds] = useState<ProviderKind[]>([]);
  const [kindsError, setKindsError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);

  const [discovery, setDiscovery] = useState<ModelDiscovery | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<unknown>(null);
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LlmProvider | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Discovery is per-provider and racy by nature (switch provider, hit refresh,
  // switch back); only the newest request may write to state.
  const discoveryRequest = useRef(0);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.slug === selection.providerSlug) ?? null,
    [providers, selection.providerSlug],
  );

  const loadProviders = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const body = await listProviders();
      setProviders(body.providers);
      setDefaultProvider(body.default_provider);
      return body.providers;
    } catch (error) {
      setListError(error);
      return null;
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadProviders();
    listProviderKinds()
      .then((loaded) => {
        setKinds(loaded);
        setKindsError(null);
      })
      // The kind list only drives the add/edit form, so failing to load it must
      // not take the whole panel down — but swallowing it silently leaves an
      // empty dropdown that cannot be opened and an Add form that can never be
      // submitted, with nothing on screen explaining why.
      .catch((cause: unknown) => {
        setKinds([]);
        setKindsError(
          cause instanceof Error
            ? cause.message
            : "Could not load the list of provider types.",
        );
      });
  }, [active, loadProviders]);

  // Settle on a provider: keep the saved one if it still exists, otherwise fall
  // back to the server's default so the panel is never pointing at nothing.
  useEffect(() => {
    if (providers.length === 0) return;
    if (providers.some((p) => p.slug === selection.providerSlug)) return;
    const fallback =
      providers.find((p) => p.slug === defaultProvider) ??
      providers.find((p) => p.enabled) ??
      providers[0];
    setSelection({ providerSlug: fallback.slug, model: "" });
  }, [providers, defaultProvider, selection.providerSlug, setSelection]);

  // Publish the (non-secret) endpoint so the session panel and the agent route
  // agree with what is shown here.
  useEffect(() => {
    if (!selectedProvider) return;
    setResolved({ endpoint: selectedProvider.base_url });
  }, [selectedProvider, setResolved]);

  const loadModels = useCallback(
    async (slug: string, refresh: boolean) => {
      const request = ++discoveryRequest.current;
      setDiscoveryLoading(true);
      setDiscoveryError(null);
      setModelNotice(null);
      try {
        const result = await discoverModels(slug, { refresh });
        if (request !== discoveryRequest.current) return;
        setDiscovery(result);
      } catch (error) {
        if (request !== discoveryRequest.current) return;
        // A thrown error here is a real failure (404, no session) rather than
        // "the box is off", which arrives as a 200 with ok:false.
        setDiscovery(null);
        setDiscoveryError(error);
      } finally {
        if (request === discoveryRequest.current) setDiscoveryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!active || !selectedProvider) return;
    setTestResult(null);
    setTestError(null);
    void loadModels(selectedProvider.slug, false);
  }, [active, selectedProvider, loadModels]);

  const models: DiscoveredModel[] =
    discovery && discovery.ok ? discovery.models : [];

  // Reconcile the saved model against what the provider actually offers. Doing
  // it here — loudly — is the whole point: the alternative is a 404 at send
  // time, long after the user could connect it to a settings change.
  useEffect(() => {
    if (!selectedProvider || !discovery?.ok || models.length === 0) return;
    const current = selection.model.trim();
    const match = models.find((m) => m.id === current);
    if (match) {
      setResolved({ contextWindow: match.context_window });
      return;
    }
    const fallback =
      models.find((m) => m.id === selectedProvider.default_model) ?? models[0];
    setSelection({ model: fallback.id });
    setResolved({ contextWindow: fallback.context_window });
    if (current) {
      setModelNotice(
        `"${current}" is no longer offered by ${selectedProvider.label}. Switched to "${fallback.id}".`,
      );
    }
  }, [discovery, models, selection.model, selectedProvider, setSelection, setResolved]);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selection.model) ?? null,
    [models, selection.model],
  );

  const handleSelectModel = (value: string) => {
    setSelection({ model: value });
    setModelNotice(null);
    setTestResult(null);
    const chosen = models.find((m) => m.id === value);
    setResolved({ contextWindow: chosen?.context_window ?? null });
  };

  const handleToggleEnabled = async (provider: LlmProvider, enabled: boolean) => {
    setBusySlug(provider.slug);
    setNotice(null);
    try {
      const saved = await updateProvider(provider.slug, { enabled });
      setProviders((current) =>
        current.map((p) => (p.slug === saved.slug ? saved : p)),
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update the provider.",
      );
    } finally {
      setBusySlug(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusySlug(pendingDelete.slug);
    try {
      await deleteProvider(pendingDelete.slug);
      const wasSelected = pendingDelete.slug === selection.providerSlug;
      setPendingDelete(null);
      if (wasSelected) setSelection({ providerSlug: "", model: "" });
      await loadProviders();
      setNotice(`Deleted ${pendingDelete.label}.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not delete the provider.",
      );
    } finally {
      setBusySlug(null);
    }
  };

  const handleSaved = (saved: LlmProvider, created: boolean) => {
    setNotice(created ? `Added ${saved.label}.` : `Saved ${saved.label}.`);
    void loadProviders().then(() => {
      if (created) setSelection({ providerSlug: saved.slug, model: "" });
    });
  };

  const handleTest = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await testProvider(
        selectedProvider.slug,
        selection.model || undefined,
      );
      setTestResult(result);
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "The test request failed.",
      );
    } finally {
      setTesting(false);
    }
  };

  const discoveryFailed = discovery !== null && !discovery.ok;

  return (
    <div className="grid gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Providers and their keys live on the server. This browser only remembers
        which provider and model you picked — never a key.
      </p>

      {/* --- providers ---------------------------------------------------- */}
      <section className={SECTION_CLASS} aria-label="Providers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Providers</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingProvider(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add provider
          </Button>
        </div>

        <AsyncBoundary
          loading={listLoading}
          error={listError}
          empty={providers.length === 0}
          label="providers"
          skeleton={<SkeletonList count={3} />}
          onRetry={() => void loadProviders()}
          emptyIcon={Server}
          emptyTitle="No providers configured"
          emptyDescription="Add one to point the workspace at a model server."
          emptyAction={
            <Button
              type="button"
              onClick={() => {
                setEditingProvider(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add provider
            </Button>
          }
        >
          <div
            role="radiogroup"
            aria-label="Active provider"
            className="grid gap-2"
          >
            {providers.map((provider) => (
              <ProviderRow
                key={provider.slug}
                provider={provider}
                selected={provider.slug === selection.providerSlug}
                busy={busySlug === provider.slug}
                onSelect={() =>
                  setSelection({ providerSlug: provider.slug, model: "" })
                }
                onEdit={() => {
                  setEditingProvider(provider);
                  setFormOpen(true);
                }}
                onDelete={() => setPendingDelete(provider)}
                onToggleEnabled={(enabled) =>
                  void handleToggleEnabled(provider, enabled)
                }
              />
            ))}
          </div>
        </AsyncBoundary>

        {notice && <StatusLine severity="info" title={notice} />}
      </section>

      {/* --- model -------------------------------------------------------- */}
      {selectedProvider && (
        <section className={SECTION_CLASS} aria-label="Model">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-medium">
              Model
              <span className="ml-1.5 font-normal text-muted-foreground">
                on {selectedProvider.label}
              </span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadModels(selectedProvider.slug, true)}
              disabled={discoveryLoading}
            >
              {discoveryLoading ? (
                <RefreshCw className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </Button>
          </div>

          {discoveryLoading && (
            <div aria-busy="true" className="grid gap-2">
              <span className="sr-only">Loading models…</span>
              <SkeletonList count={1} />
            </div>
          )}

          {!discoveryLoading && discoveryError != null && (
            <StatusLine
              severity="error"
              title="Could not ask the server for models"
              detail={
                discoveryError instanceof Error
                  ? discoveryError.message
                  : "Unknown error."
              }
            />
          )}

          {!discoveryLoading && discoveryFailed && (
            <StatusLine
              severity="warning"
              title="This provider did not answer"
              detail={`${
                (discovery as { error?: string }).error ?? "No detail given."
              } An endpoint that is switched off is normal — start it and refresh, or type a model name below.`}
            />
          )}

          {!discoveryLoading && discovery?.ok && models.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="llm-model-select">Model</Label>
              <Select
                value={selection.model || undefined}
                onValueChange={handleSelectModel}
              >
                <SelectTrigger id="llm-model-select">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {models.length} model{models.length === 1 ? "" : "s"} offered
                {discovery.cached ? " (cached — refresh to re-ask)" : ""}.
              </p>
            </div>
          )}

          {!discoveryLoading && discovery?.ok && models.length === 0 && (
            <EmptyState
              compact
              icon={Server}
              title="The server offers no models"
              description="It answered, but its model list is empty. Enter a name below if you know one it serves."
            />
          )}

          {/* An escape hatch, so an offline or silent server never leaves the
              user unable to name the model they know is there. */}
          {!discoveryLoading && (discoveryFailed || models.length === 0) && (
            <Field
              label="Model name"
              hint="Sent as-is when the provider cannot be asked for a list."
            >
              <Input
                value={selection.model}
                onChange={(e) => setSelection({ model: e.target.value })}
                placeholder={selectedProvider.default_model || "local-model"}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          )}

          {modelNotice && (
            <StatusLine
              severity="warning"
              title="The saved model is gone"
              detail={modelNotice}
            />
          )}

          {selectedModel && (
            <div className="flex flex-wrap items-center gap-1.5">
              {formatContext(selectedModel.context_window) && (
                <Badge variant="muted">
                  {formatContext(selectedModel.context_window)}
                </Badge>
              )}
              {selectedModel.max_output_tokens ? (
                <Badge variant="muted">
                  {selectedModel.max_output_tokens} max output
                </Badge>
              ) : null}
              {selectedModel.capabilities.map((capability) => (
                <Badge key={capability} variant="outline">
                  {capability}
                </Badge>
              ))}
              {selectedModel.capability_source === "guessed" && (
                <span className="text-xs text-muted-foreground">
                  capabilities inferred from the model id
                </span>
              )}
            </div>
          )}

          {/* Many OpenAI-compatible servers report no context window at all, and
              without this the chat's context ring reads "limit unknown"
              forever. A value here wins over discovery. */}
          <Field
            label="Context limit"
            hint={
              selectedModel?.context_window
                ? `Discovery reports ${formatContext(selectedModel.context_window)}. Set a value to override it.`
                : "This provider does not report a context window. Set one so the chat can show how full the context is."
            }
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder={
                selectedModel?.context_window
                  ? String(selectedModel.context_window)
                  : "e.g. 32768"
              }
              value={selection.maxContextTokens ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                const parsed = Number(raw);
                setSelection({
                  maxContextTokens:
                    raw === "" || !Number.isFinite(parsed) || parsed <= 0
                      ? null
                      : Math.floor(parsed),
                });
              }}
            />
          </Field>
        </section>
      )}

      {/* --- test --------------------------------------------------------- */}
      {selectedProvider && (
        <section className={SECTION_CLASS} aria-label="Connection test">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Connection</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing && <Loader2 className="animate-spin" />}
              {testing ? "Testing…" : "Test connection"}
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Listing models proves the endpoint answers; it does not prove the key
            is accepted for generation. Both are checked separately.
          </p>

          <div role="status" className="grid gap-2">
            {testError && (
              <StatusLine
                severity="error"
                title="The test could not run"
                detail={testError}
              />
            )}

            {testResult && (
              <>
                <StatusLine
                  severity={testResult.reachable ? "success" : "error"}
                  title={
                    testResult.reachable
                      ? `Reachable — ${testResult.model_count} model${
                          testResult.model_count === 1 ? "" : "s"
                        } listed`
                      : "Not reachable"
                  }
                  detail={!testResult.reachable ? testResult.error : undefined}
                />
                <StatusLine
                  severity={
                    testResult.generated
                      ? "success"
                      : testResult.reachable
                        ? "error"
                        : "info"
                  }
                  title={
                    testResult.generated
                      ? `Generated with ${testResult.model}`
                      : testResult.reachable
                        ? "Generation failed"
                        : "Generation not attempted"
                  }
                  detail={
                    testResult.generated
                      ? testResult.sample
                        ? `Replied: "${testResult.sample}"`
                        : "Replied with an empty message."
                      : testResult.reachable
                        ? testResult.error
                        : "The endpoint has to answer first."
                  }
                />
              </>
            )}
          </div>
        </section>
      )}

      <ProviderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        kinds={kinds}
        kindsError={kindsError}
        provider={editingProvider}
        onSaved={handleSaved}
      />

      <DeleteProviderDialog
        provider={pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => void handleDelete()}
        busy={busySlug === pendingDelete?.slug}
      />
    </div>
  );
}
