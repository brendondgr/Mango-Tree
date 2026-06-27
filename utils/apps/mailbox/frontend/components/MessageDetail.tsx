import { type CSSProperties } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { EmailBody } from "@mailbox/components/EmailBody";
import { ProviderIcon } from "@mailbox/components/ProviderIcon";
import type { InboxMessage } from "@mailbox/hooks/useMailbox";
import { useMessage } from "@mailbox/hooks/useMailbox";
import {
  type Accent,
  accentClass,
  parseSender,
  providerLabel,
} from "@mailbox/utils/colors";
import { formatFullDate } from "@mailbox/utils/format";

interface Props {
  message: InboxMessage;
  accountLabel: string;
  accountAccent: Accent;
  folder: string;
  canFetch: boolean;
  onBack: () => void;
  backClassName?: string;
}

export function MessageDetail({
  message,
  accountLabel,
  accountAccent,
  folder,
  canFetch,
  onBack,
  backClassName,
}: Props) {
  const textSize = useWorkspaceStore((s) => s.mailboxPrefs.textSize);
  const bodySize = textSize === "sm" ? "0.85rem" : textSize === "lg" ? "1.02rem" : "0.9rem";
  const sender = parseSender(message.from);
  // List messages arrive without a body; fetch the full message on open.
  const needsFetch = canFetch && message.body_text === null && message.body_html === null;
  const fetched = useMessage(message.accountId, message.uid, folder, needsFetch);
  const body = message.body_text ?? fetched.data?.body_text ?? "";
  const html = message.body_html ?? fetched.data?.body_html ?? null;

  return (
    <div className="mailbox-app flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className={cn("gap-1.5", backClassName)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="ml-auto truncate text-xs text-muted-foreground">{accountLabel}</span>
      </header>

      <div className="mailbox-scroll min-h-0 flex-1 overflow-y-auto">
        <div
          className="mx-auto w-full max-w-3xl p-5 lg:p-7"
          style={{ "--mailbox-body-size": bodySize } as CSSProperties}
        >
          <h1 className="text-xl font-semibold leading-snug text-foreground">
            {message.subject || "(no subject)"}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={cn("mailbox-provider h-10 w-10", accentClass(accountAccent))}
              title={providerLabel(message.provider)}
              aria-hidden
            >
              <ProviderIcon provider={message.provider} className="mailbox-provider-glyph" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{sender.name}</div>
              <div className="truncate text-xs text-muted-foreground">{sender.email}</div>
            </div>
            <div className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
              {formatFullDate(message.date)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={cn("mailbox-badge", accentClass(accountAccent))}>{accountLabel}</span>
            <span className="mailbox-badge mailbox-c-primary opacity-80">
              {providerLabel(message.provider)}
            </span>
            <span className="text-xs text-muted-foreground">to {message.to || "you"}</span>
          </div>

          <Separator className="my-5" />

          {needsFetch && fetched.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading message…
            </div>
          ) : needsFetch && fetched.isError ? (
            <div className="text-sm text-destructive">
              {(fetched.error as Error)?.message ?? "Could not load this message."}
            </div>
          ) : (
            <EmailBody html={html} text={body} />
          )}
        </div>
      </div>
    </div>
  );
}
