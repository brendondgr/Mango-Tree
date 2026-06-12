import "katex/dist/katex.min.css";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
};

const textWrap = "min-w-0 break-words [overflow-wrap:anywhere]";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className={cn("mb-2 leading-relaxed last:mb-0", textWrap)}>{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
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
    <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs last:mb-0">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1
      className={cn(
        "mt-2 mb-1 text-base font-bold tracking-tight first:mt-0 last:mb-0",
        textWrap,
      )}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={cn("mb-1 text-sm font-bold last:mb-0", textWrap)}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3
      className={cn("mb-1 text-sm font-semibold text-foreground/90 last:mb-0", textWrap)}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      className={cn(
        "mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase last:mb-0",
        textWrap,
      )}
    >
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5
      className={cn(
        "mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase last:mb-0",
        textWrap,
      )}
    >
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6
      className={cn(
        "mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase last:mb-0",
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

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "text-sm text-foreground [&>*:first-child]:mt-0 [&_.katex]:text-inherit [&_del]:text-muted-foreground [&_del]:line-through [&_em]:italic [&_strong]:font-semibold",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
