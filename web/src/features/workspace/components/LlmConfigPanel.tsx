import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_LLM_CONFIG,
  useLlmConfigStore,
} from "@/app/stores/llmConfigStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LlmClientError, queryLlm } from "@/services/llmClient";
import { fetchModelList } from "@/services/llmModelInfo";
import type { LlmConfig } from "@/services/llmTypes";
import { cn } from "@/lib/utils";

interface LlmConfigPanelProps {
  active?: boolean;
}

type Severity = "success" | "warning" | "error";

interface ResultState {
  severity: Severity;
  title: string;
  detail?: string;
}

const CUSTOM_MODEL_VALUE = "__custom__";

function normalizeConfig(config: LlmConfig) {
  return {
    baseUrl: config.baseUrl.trim(),
    model: config.model.trim(),
    apiKey: config.apiKey.trim(),
    maxContextTokens: config.maxContextTokens ?? null,
  };
}

function configsEqual(a: LlmConfig, b: LlmConfig): boolean {
  const na = normalizeConfig(a);
  const nb = normalizeConfig(b);
  return (
    na.baseUrl === nb.baseUrl &&
    na.model === nb.model &&
    na.apiKey === nb.apiKey &&
    na.maxContextTokens === nb.maxContextTokens
  );
}

const SECTION_CLASS =
  "grid gap-4 rounded-[var(--radius-md)] border border-border p-4";

const RESULT_STYLES: Record<Severity, { box: string; icon: typeof CheckCircle2 }> =
  {
    success: {
      box: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      icon: CheckCircle2,
    },
    warning: {
      box: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      icon: AlertTriangle,
    },
    error: {
      box: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
  };

function ResultCard({ result }: { result: ResultState }) {
  const { box, icon: Icon } = RESULT_STYLES[result.severity];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm",
        box,
      )}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium leading-tight">{result.title}</p>
        {result.detail && (
          <p className="break-words text-xs leading-snug opacity-90">
            {result.detail}
          </p>
        )}
      </div>
    </div>
  );
}

export function LlmConfigPanel({ active = true }: LlmConfigPanelProps) {
  const savedConfig = useLlmConfigStore((s) => s.config);
  const setConfig = useLlmConfigStore((s) => s.setConfig);
  const resetConfig = useLlmConfigStore((s) => s.resetConfig);

  const [draft, setDraft] = useState<LlmConfig>(savedConfig);
  const [result, setResult] = useState<ResultState | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [modelsState, setModelsState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [customModel, setCustomModel] = useState(false);

  const effectiveConfig = useCallback(
    (): LlmConfig => ({
      baseUrl: draft.baseUrl.trim() || DEFAULT_LLM_CONFIG.baseUrl,
      model: draft.model.trim() || DEFAULT_LLM_CONFIG.model,
      apiKey: draft.apiKey.trim(),
      maxContextTokens: draft.maxContextTokens ?? null,
    }),
    [draft],
  );

  const loadModels = useCallback(
    async (silent: boolean) => {
      setModelsState("loading");
      try {
        const list = await fetchModelList(effectiveConfig());
        setModels(list);
        setModelsState("idle");
        return list;
      } catch {
        setModels([]);
        setModelsState("error");
        if (!silent) {
          setResult({
            severity: "error",
            title: "Could not list models",
            detail: `Failed to reach ${draft.baseUrl.trim() || DEFAULT_LLM_CONFIG.baseUrl}. Check the base URL and that the server is running.`,
          });
        }
        return null;
      }
    },
    [draft.baseUrl, effectiveConfig],
  );

  useEffect(() => {
    if (!active) return;
    setDraft(savedConfig);
    setResult(null);
    setSaveNotice(null);
    setModels([]);
    setModelsState("idle");
    setCustomModel(false);
    void loadModels(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, savedConfig]);

  const dirty = useMemo(
    () => !configsEqual(draft, savedConfig),
    [draft, savedConfig],
  );

  const showModelInput =
    customModel || models.length === 0 || !models.includes(draft.model.trim());

  const updateField = (field: keyof LlmConfig, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setResult(null);
    setSaveNotice(null);
  };

  const updateMaxContext = (value: string) => {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number.parseInt(trimmed, 10);
    setDraft((current) => ({
      ...current,
      maxContextTokens:
        parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    }));
    setResult(null);
    setSaveNotice(null);
  };

  const selectModel = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      return;
    }
    setCustomModel(false);
    updateField("model", value);
  };

  const handleSave = () => {
    setConfig(effectiveConfig());
    setResult(null);
    setSaveNotice("Settings saved. The chat agent will now use this configuration.");
  };

  const handleReset = () => {
    resetConfig();
    setDraft(DEFAULT_LLM_CONFIG);
    setCustomModel(false);
    setModels([]);
    setModelsState("idle");
    setResult(null);
    setSaveNotice("Reset to defaults. Remember to save if you want to keep this.");
  };

  const handleTest = async () => {
    setIsTesting(true);
    setResult(null);
    setSaveNotice(null);
    const testConfig = effectiveConfig();

    // Stage 1: reachability (and capture the model list).
    let discovered: string[] | null = null;
    try {
      discovered = await fetchModelList(testConfig);
      setModels(discovered);
      setModelsState("idle");
    } catch (error) {
      if (error instanceof TypeError) {
        // Network-level failure: the server isn't answering at all.
        setResult({
          severity: "error",
          title: "Server not found",
          detail: `${testConfig.baseUrl} could not be reached. Is the server running and is the base URL correct?`,
        });
        setIsTesting(false);
        return;
      }
      // The server answered but /models failed (e.g. 404/401). Note it, then
      // still try a chat round-trip — some servers don't expose /models.
      setModelsState("error");
    }

    // Stage 2: chat round-trip.
    let reply: string;
    try {
      reply = await queryLlm(
        [{ role: "user", content: "Reply with exactly: OK" }],
        testConfig,
      );
    } catch (error) {
      const detail =
        error instanceof LlmClientError
          ? error.message
          : "The chat request failed for an unknown reason.";
      setResult({
        severity: "error",
        title: "Server found, but the chat request failed",
        detail,
      });
      setIsTesting(false);
      return;
    }

    // Stage 3: success — flag if the model isn't in the advertised list.
    const snippet = reply.trim().slice(0, 120) || "(empty response)";
    const modelKnown =
      !discovered ||
      discovered.length === 0 ||
      discovered.includes(testConfig.model);

    if (!modelKnown) {
      setResult({
        severity: "warning",
        title: "Connected, but the model was not listed",
        detail: `The server is reachable, but "${testConfig.model}" is not in its advertised model list. It still replied: "${snippet}".`,
      });
    } else {
      setResult({
        severity: "success",
        title: "Connection OK — server found and model responded",
        detail: `"${testConfig.model}" replied: "${snippet}".`,
      });
    }
    setIsTesting(false);
  };

  const modelButtonLabel = showModelInput
    ? "Pick from server"
    : draft.model.trim() || "Select a model";

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Configure the OpenAI-compatible endpoint used by chat and the agent.
        Defaults target localhost on port 9090.
      </p>

      <section className={SECTION_CLASS} aria-label="Connection">
        <p className="text-sm font-medium">Connection</p>

        <div className="grid gap-2">
          <Label htmlFor="llm-base-url">Base URL</Label>
          <Input
            id="llm-base-url"
            value={draft.baseUrl}
            onChange={(e) => updateField("baseUrl", e.target.value)}
            placeholder="http://localhost:9090/v1"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="llm-api-key">API key (optional)</Label>
          <Input
            id="llm-api-key"
            type="password"
            value={draft.apiKey}
            onChange={(e) => updateField("apiKey", e.target.value)}
            placeholder="Leave empty for local servers"
            autoComplete="off"
          />
        </div>
      </section>

      <section className={SECTION_CLASS} aria-label="Model">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Model</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadModels(false)}
            disabled={modelsState === "loading"}
          >
            {modelsState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh models
          </Button>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="llm-model">Model name</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-[12rem] justify-between font-normal"
                  disabled={models.length === 0}
                >
                  <span className="truncate">{modelButtonLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={showModelInput ? CUSTOM_MODEL_VALUE : draft.model.trim()}
                  onValueChange={selectModel}
                >
                  {models.map((id) => (
                    <DropdownMenuRadioItem key={id} value={id}>
                      <span className="truncate">{id}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCustomModel(true)}>
                  Enter a custom model…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {models.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {modelsState === "loading"
                  ? "Loading models…"
                  : "No models discovered — enter one below."}
              </span>
            )}
          </div>

          {showModelInput && (
            <Input
              id="llm-model"
              value={draft.model}
              onChange={(e) => updateField("model", e.target.value)}
              placeholder="local-model"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </div>
      </section>

      <section className={SECTION_CLASS} aria-label="Advanced">
        <p className="text-sm font-medium">Advanced</p>
        <div className="grid gap-2">
          <Label htmlFor="llm-max-context">Max context (optional override)</Label>
          <Input
            id="llm-max-context"
            type="number"
            min={1}
            value={draft.maxContextTokens ?? ""}
            onChange={(e) => updateMaxContext(e.target.value)}
            placeholder="Auto from /v1/models"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Used for the context ring when the server does not report
            max_model_len.
          </p>
        </div>
      </section>

      {result && <ResultCard result={result} />}
      {saveNotice && !result && (
        <ResultCard result={{ severity: "success", title: saveNotice }} />
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        {dirty && (
          <span className="text-xs text-muted-foreground sm:mr-auto">
            Unsaved changes
          </span>
        )}
        <Button type="button" variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={isTesting}
        >
          {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button type="button" onClick={handleSave} disabled={!dirty}>
          Save
        </Button>
      </div>
    </div>
  );
}
