import "katex/dist/katex.min.css";
import "@/components/markdown/codeHighlight.css";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { MarkdownCodeBlock } from "@/components/markdown/MarkdownCodeBlock";
import { CitationBadge } from "@/features/chat/components/CitationBadge";
import {
  buildReferencesByIndex,
  resolveCitationIndex,
} from "@/features/chat/utils/citationMarkdown";
import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";
import { linkifyCitations } from "@/features/chat/utils/linkifyCitations";
import { cn } from "@/lib/utils";

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "cite"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
};

const textWrap = "min-w-0 break-words [overflow-wrap:anywhere]";

type MarkdownVariant = "default" | "chat";

function createMarkdownComponents(
  variant: MarkdownVariant,
  references?: ChatReference[],
): Components {
  const isChat = variant === "chat";
  const chatHeadingColor = "text-accent";
  const referencesByIndex = buildReferencesByIndex(references ?? []);

  return {
  p: ({ children }) => (
    <p className={cn("mb-2 leading-relaxed last:mb-0", textWrap)}>{children}</p>
  ),
  a: ({ href, children }) => {
    const citationIndex = resolveCitationIndex(
      href,
      children,
      referencesByIndex,
    );
    if (citationIndex !== null) {
      const reference = referencesByIndex.get(citationIndex)!;
      return (
        <CitationBadge index={citationIndex} url={reference.url} />
      );
    }

    return (
      <a
        href={href}
        className="text-primary underline underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => (
    <strong
      className={cn(
        isChat ? "font-bold text-primary" : "font-semibold text-foreground",
      )}
    >
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className={cn("italic", isChat && "text-accent")}>{children}</em>
  ),
  del: ({ children }) => (
    <del className="text-muted-foreground line-through">{children}</del>
  ),
  u: ({ children }) => (
    <u className="underline underline-offset-2">{children}</u>
  ),
  ul: ({ children }) => (
    <ul className={cn("mb-2 ml-4 list-disc last:mb-0", textWrap)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={cn("mb-2 ml-4 list-decimal last:mb-0", textWrap)}>{children}</ol>
  ),
  li: ({ children }) => (
    <li className={cn("mb-1 last:mb-0", textWrap)}>{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className={cn(
        "mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0",
        textWrap,
      )}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={cn("font-mono text-xs", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "rounded bg-muted px-1 py-0.5 font-mono text-xs",
          textWrap,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <MarkdownCodeBlock stickyHeader={isChat}>{children}</MarkdownCodeBlock>
  ),
  h1: ({ children }) => (
    <h1
      className={cn(
        "mt-2 mb-1 font-bold tracking-tight first:mt-0 last:mb-0",
        isChat ? cn("text-2xl", chatHeadingColor) : "text-base",
        textWrap,
      )}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className={cn(
        "mb-1 font-bold last:mb-0",
        isChat ? cn("mt-2 text-xl", chatHeadingColor) : "text-sm",
        textWrap,
      )}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className={cn(
        "mb-1 font-semibold last:mb-0",
        isChat
          ? cn("mt-1.5 text-lg font-bold", chatHeadingColor)
          : "text-sm text-foreground/90",
        textWrap,
      )}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      className={cn(
        "mb-1 font-semibold tracking-wide last:mb-0",
        isChat
          ? cn("text-base font-bold", chatHeadingColor)
          : "text-xs text-muted-foreground uppercase",
        textWrap,
      )}
    >
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5
      className={cn(
        "mb-1 font-semibold tracking-wide last:mb-0",
        isChat
          ? cn("text-sm font-bold", chatHeadingColor)
          : "text-xs text-muted-foreground uppercase",
        textWrap,
      )}
    >
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6
      className={cn(
        "mb-1 font-semibold tracking-wide last:mb-0",
        isChat
          ? cn("text-sm font-semibold uppercase", chatHeadingColor)
          : "text-xs text-muted-foreground uppercase",
        textWrap,
      )}
    >
      {children}
    </h6>
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
  };
}

const defaultMarkdownComponents = createMarkdownComponents("default");

interface MarkdownContentProps {
  content: string;
  className?: string;
  variant?: MarkdownVariant;
  references?: ChatReference[];
}

export function MarkdownContent({
  content,
  className,
  variant = "default",
  references,
}: MarkdownContentProps) {
  const isChat = variant === "chat";
  const renderedContent =
    references && references.length > 0
      ? linkifyCitations(content, references)
      : content;
  const components =
    references && references.length > 0
      ? createMarkdownComponents(variant, references)
      : variant === "chat"
        ? createMarkdownComponents("chat")
        : defaultMarkdownComponents;

  return (
    <div
      className={cn(
        "text-sm text-foreground [&>*:first-child]:mt-0 [&_.katex]:text-inherit [&_del]:text-muted-foreground [&_del]:line-through [&_em]:italic",
        isChat
          ? "[&_strong]:font-bold [&_strong]:text-primary [&_em]:text-accent"
          : "[&_strong]:font-semibold",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          rehypeRaw,
          rehypeHighlight,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={components}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
