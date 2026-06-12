import { Check, Copy } from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  accentForLanguage,
  labelForLanguage,
  normalizeLanguage,
  stylesForAccent,
} from "@/components/markdown/codeBlockAccent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ParsedCodeBlock {
  language: string;
  code: string;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

function parseCodeBlock(children: ReactNode): ParsedCodeBlock | null {
  const child = Children.toArray(children)[0];

  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    return null;
  }

  const className = child.props.className ?? "";
  const languageMatch = /language-([\w+#.-]+)/i.exec(className);
  const language = normalizeLanguage(languageMatch?.[1]);
  const code = extractText(child.props.children).replace(/\n$/, "");

  return { language, code };
}

interface MarkdownCodeBlockProps {
  children: ReactNode;
  className?: string;
}

export function MarkdownCodeBlock({
  children,
  className,
}: MarkdownCodeBlockProps) {
  const parsed = parseCodeBlock(children);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!parsed?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(parsed.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [parsed?.code]);

  if (!parsed) {
    return (
      <pre
        className={cn(
          "mb-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs last:mb-0",
          className,
        )}
      >
        {children}
      </pre>
    );
  }

  const accent = accentForLanguage(parsed.language);
  const accentStyles = stylesForAccent(accent);
  const codeChild = Children.toArray(children)[0];

  return (
    <div
      className={cn(
        "group/code mb-2 overflow-hidden rounded-md border bg-muted/35 last:mb-0",
        accentStyles.border,
        className,
      )}
    >
      <div className="relative max-h-[min(24rem,50vh)] overflow-auto">
        <div
          className={cn(
            "sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5 backdrop-blur-sm",
            accentStyles.header,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn("h-4 w-1 shrink-0 rounded-full", accentStyles.rail)}
            />
            <span
              className={cn(
                "truncate font-mono text-[11px] font-semibold tracking-wide uppercase",
                accentStyles.badge,
              )}
            >
              {labelForLanguage(parsed.language)}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void handleCopy()}
            aria-label={copied ? "Code copied" : "Copy code to clipboard"}
          >
            {copied ? (
              <>
                <Check aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy aria-hidden />
                Copy
              </>
            )}
          </Button>
        </div>
        <pre className="m-0 overflow-x-auto p-3 font-mono text-xs leading-relaxed">
          {isValidElement<{ className?: string }>(codeChild)
            ? cloneElement(codeChild, {
                className: cn(
                  "block bg-transparent font-mono text-xs",
                  codeChild.props.className,
                ),
              })
            : children}
        </pre>
      </div>
    </div>
  );
}
