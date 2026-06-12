import { useEffect, useMemo, useState } from "react";

import type { ChatMessage } from "@/app/stores/workspaceStore";
import type { PendingAttachment } from "@/features/chat/types/attachment";
import { buildLlmMessages } from "@/features/chat/utils/buildLlmMessageContent";
import { estimateMessageTokens } from "@/services/estimateTokens";
import { fetchModelMaxContext } from "@/services/llmModelInfo";
import { tokenizeMessages } from "@/services/llmTokenize";
import type { LlmConfig, LlmUsage } from "@/services/llmTypes";

const DEBOUNCE_MS = 300;

function buildDraftMessage(
  draftText: string,
  readyAttachments: PendingAttachment[],
): ChatMessage | null {
  const attachments = readyAttachments
    .map((pending) => pending.attachment)
    .filter((attachment): attachment is NonNullable<typeof attachment> =>
      Boolean(attachment),
    );

  if (!draftText.trim() && attachments.length === 0) {
    return null;
  }

  return {
    id: "draft",
    role: "user",
    content: draftText,
    attachments: attachments.length > 0 ? attachments : undefined,
    timestamp: new Date(),
  };
}

function messagesForCounting(
  history: ChatMessage[],
  draftText: string,
  readyAttachments: PendingAttachment[],
): ChatMessage[] {
  const persisted = history.filter((message) => !message.isStreaming);
  const draft = buildDraftMessage(draftText, readyAttachments);
  return draft ? [...persisted, draft] : persisted;
}

export interface ContextUsageState {
  usedTokens: number | null;
  maxTokens: number | null;
  percent: number | null;
  isLoading: boolean;
  isEstimated: boolean;
  label: string;
}

export function useContextUsage(
  history: ChatMessage[],
  draftText: string,
  readyAttachments: PendingAttachment[],
  llmConfig: LlmConfig,
  lastKnownUsage: LlmUsage | null,
): ContextUsageState {
  const [maxTokens, setMaxTokens] = useState<number | null>(
    llmConfig.maxContextTokens ?? null,
  );
  const [usedTokens, setUsedTokens] = useState<number | null>(null);
  const [isEstimated, setIsEstimated] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [isLoadingMax, setIsLoadingMax] = useState(false);

  const payloadMessages = useMemo(
    () => buildLlmMessages(messagesForCounting(history, draftText, readyAttachments)),
    [history, draftText, readyAttachments],
  );

  const draftOnlyMessages = useMemo(() => {
    const draft = buildDraftMessage(draftText, readyAttachments);
    if (!draft) return [];
    return buildLlmMessages([draft]);
  }, [draftText, readyAttachments]);

  useEffect(() => {
    const override = llmConfig.maxContextTokens;
    if (override != null && override > 0) {
      setMaxTokens(override);
      return;
    }

    const controller = new AbortController();
    setIsLoadingMax(true);

    void fetchModelMaxContext(llmConfig, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setMaxTokens(value);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingMax(false);
        }
      });

    return () => controller.abort();
  }, [llmConfig.baseUrl, llmConfig.model, llmConfig.apiKey, llmConfig.maxContextTokens]);

  useEffect(() => {
    if (payloadMessages.length === 0) {
      setUsedTokens(null);
      setIsEstimated(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsCounting(true);

      void tokenizeMessages(payloadMessages, llmConfig, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;

          if (result) {
            setUsedTokens(result.count);
            setIsEstimated(false);
            if (result.maxModelLen != null && !llmConfig.maxContextTokens) {
              setMaxTokens(result.maxModelLen);
            }
            return;
          }

          const estimate = estimateMessageTokens(payloadMessages);
          setUsedTokens(estimate.count);
          setIsEstimated(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsCounting(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    payloadMessages,
    llmConfig.baseUrl,
    llmConfig.model,
    llmConfig.apiKey,
    llmConfig.maxContextTokens,
  ]);

  const reconciledUsedTokens = useMemo(() => {
    if (usedTokens != null) return usedTokens;

    if (!lastKnownUsage) return null;

    const draftEstimate =
      draftOnlyMessages.length > 0
        ? estimateMessageTokens(draftOnlyMessages).count
        : 0;

    return lastKnownUsage.totalTokens + draftEstimate;
  }, [lastKnownUsage, usedTokens, draftOnlyMessages]);

  const percent =
    reconciledUsedTokens != null && maxTokens != null && maxTokens > 0
      ? (reconciledUsedTokens / maxTokens) * 100
      : null;

  const label = useMemo(() => {
    if (reconciledUsedTokens == null && maxTokens == null) {
      return "Context usage unavailable";
    }
    if (maxTokens == null) {
      return isLoadingMax
        ? "Loading context limit…"
        : `${reconciledUsedTokens?.toLocaleString() ?? "—"} tokens · limit unknown`;
    }
    if (reconciledUsedTokens == null) {
      return isCounting ? "Counting tokens…" : "Counting tokens…";
    }
    const prefix = isEstimated ? "~" : "";
    return `${prefix}${reconciledUsedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens`;
  }, [reconciledUsedTokens, maxTokens, isLoadingMax, isCounting, isEstimated]);

  return {
    usedTokens: reconciledUsedTokens,
    maxTokens,
    percent,
    isLoading: isLoadingMax || isCounting,
    isEstimated,
    label,
  };
}
