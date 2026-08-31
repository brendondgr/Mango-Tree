import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  cleanPlainText,
  linkifySegments,
  sanitizeEmailHtml,
} from "@mailbox/utils/renderEmail";

interface Props {
  html: string | null;
  text: string | null;
}

/** Renders an email body. HTML is sanitized and shown in a locked-down sandboxed
 *  iframe with remote content blocked until the user opts in; otherwise the
 *  plain-text body is cleaned up and linkified. */
export function EmailBody({ html, text }: Props) {
  if (html && html.trim()) return <HtmlBody html={html} />;
  if (text && text.trim()) return <TextBody text={text} />;
  return <p className="text-sm text-muted-foreground">(no content)</p>;
}

function HtmlBody({ html }: { html: string }) {
  const [allowRemote, setAllowRemote] = useState(false);
  const { html: safe, hadRemote } = useMemo(
    () => sanitizeEmailHtml(html, { allowRemote }),
    [html, allowRemote],
  );

  return (
    <div>
      {hadRemote && !allowRemote && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-primary/40 bg-primary/[0.08] px-3 py-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0 text-primary-emphasis" aria-hidden />
          <span className="min-w-0 flex-1">
            External images and content are blocked to protect your privacy and security.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setAllowRemote(true)}
          >
            Display content
          </Button>
        </div>
      )}
      <iframe
        title="Email message"
        // No allow-scripts and no allow-same-origin: scripts can't run and the
        // frame can't reach the parent page or its cookies. allow-popups lets
        // sanitized links open in a new tab on click.
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={safe}
        className="mailbox-email-frame rounded-[var(--radius-md)] border border-border"
      />
    </div>
  );
}

function TextBody({ text }: { text: string }) {
  const segments = useMemo(() => linkifySegments(cleanPlainText(text)), [text]);
  return (
    <div className="mailbox-email-text text-foreground">
      {segments.map((seg, i) =>
        seg.href ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-emphasis underline underline-offset-2"
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </div>
  );
}
