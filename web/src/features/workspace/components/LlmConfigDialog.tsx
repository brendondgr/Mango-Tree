import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DEFAULT_LLM_CONFIG,
  useLlmConfigStore,
} from "@/app/stores/llmConfigStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LlmClientError, queryLlm } from "@/services/llmClient";
import type { LlmConfig } from "@/services/llmTypes";

interface LlmConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack?: () => void;
}

export function LlmConfigDialog({
  open,
  onOpenChange,
  onBack,
}: LlmConfigDialogProps) {
  const savedConfig = useLlmConfigStore((s) => s.config);
  const setConfig = useLlmConfigStore((s) => s.setConfig);
  const resetConfig = useLlmConfigStore((s) => s.resetConfig);

  const [draft, setDraft] = useState<LlmConfig>(savedConfig);
  const [status, setStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(savedConfig);
      setStatus(null);
    }
  }, [open, savedConfig]);

  const updateField = (field: keyof LlmConfig, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus(null);
  };

  const handleSave = () => {
    setConfig({
      baseUrl: draft.baseUrl.trim() || DEFAULT_LLM_CONFIG.baseUrl,
      model: draft.model.trim() || DEFAULT_LLM_CONFIG.model,
      apiKey: draft.apiKey.trim(),
    });
    setStatus("Settings saved.");
  };

  const handleReset = () => {
    resetConfig();
    setDraft(DEFAULT_LLM_CONFIG);
    setStatus("Reset to defaults.");
  };

  const handleTest = async () => {
    setIsTesting(true);
    setStatus(null);
    const testConfig: LlmConfig = {
      baseUrl: draft.baseUrl.trim() || DEFAULT_LLM_CONFIG.baseUrl,
      model: draft.model.trim() || DEFAULT_LLM_CONFIG.model,
      apiKey: draft.apiKey.trim(),
    };

    try {
      const reply = await queryLlm(
        [{ role: "user", content: "Reply with exactly: OK" }],
        testConfig,
      );
      setStatus(`Connection OK. Model replied: ${reply.slice(0, 80)}`);
    } catch (error) {
      const message =
        error instanceof LlmClientError
          ? error.message
          : "Connection test failed.";
      setStatus(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          {onBack ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onBack}
                aria-label="Back to settings menu"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle>LLM settings</DialogTitle>
                <DialogDescription>
                  Configure the OpenAI-compatible endpoint used by chat.
                </DialogDescription>
              </div>
            </div>
          ) : (
            <>
              <DialogTitle>LLM settings</DialogTitle>
              <DialogDescription>
                Configure the OpenAI-compatible endpoint used by chat. Defaults
                target localhost on port 9090.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="llm-base-url">Base URL</Label>
            <Input
              id="llm-base-url"
              value={draft.baseUrl}
              onChange={(e) => updateField("baseUrl", e.target.value)}
              placeholder="http://localhost:9090/v1"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="llm-model">Model</Label>
            <Input
              id="llm-model"
              value={draft.model}
              onChange={(e) => updateField("model", e.target.value)}
              placeholder="local-model"
              autoComplete="off"
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

          {status && (
            <p className="text-sm text-muted-foreground" role="status">
              {status}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
