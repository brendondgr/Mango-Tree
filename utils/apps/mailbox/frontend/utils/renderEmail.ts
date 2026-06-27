// Email rendering helpers.
//
// HTML email is hostile content: it can carry scripts, tracking pixels, and
// remote resources that leak "you opened this" back to a sender. We render it
// inside a locked-down sandboxed iframe (see EmailBody), and additionally:
//
//  1. strip active/dangerous markup (scripts, event handlers, javascript: URLs)
//     as defense-in-depth, and
//  2. block REMOTE resources (external images/CSS) until the user explicitly
//     asks to load them — the "potentially harmful content" permission gate.
//
// Parsing happens via DOMParser, which builds an inert document: it neither runs
// scripts nor fetches resources. Loading only ever happens once the sanitized
// string is handed to a live iframe, which is why gating must occur here first.

const DANGEROUS_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "frame",
  "frameset",
  "applet",
  "noscript",
  "form",
];

// Attributes that can carry a URL of any kind (checked for dangerous schemes).
const URL_ATTRS = ["href", "src", "action", "background", "poster", "xlink:href"];
// Attributes that LOAD a remote resource (and so are privacy-gated). `href`/
// `action` are navigation, not loads, so they are deliberately excluded.
const RESOURCE_ATTRS = ["src", "background", "poster"];
const DANGEROUS_URL = /^\s*(javascript|vbscript|data:text\/html)/i;
const REMOTE_URL = /^\s*(https?:)?\/\//i; // absolute or protocol-relative

export interface SanitizeResult {
  /** A full sanitized HTML document string, ready for an iframe `srcdoc`. */
  html: string;
  /** True when the source referenced remote resources that were blocked. */
  hadRemote: boolean;
}

interface SanitizeOptions {
  /** When false (default), remote images/CSS are neutralized. */
  allowRemote?: boolean;
}

function isRemote(url: string | null): boolean {
  return !!url && REMOTE_URL.test(url);
}

/** Strip @import and remote url(...) from a CSS string. Returns whether any
 *  remote reference was found so the caller can surface the privacy banner. */
function neutralizeCssRemotes(css: string): { css: string; had: boolean } {
  let had = false;
  let out = css.replace(/@import[^;]+;?/gi, () => {
    had = true;
    return "";
  });
  out = out.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (match, _q, url) => {
    if (isRemote(url)) {
      had = true;
      return "url()";
    }
    return match;
  });
  return { css: out, had };
}

const READING_RESET = `
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    padding: 4px 2px 24px;
    background: #ffffff;
    color: #1b1b1f;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  img, video, table { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
  a { color: #2563eb; }
  pre { white-space: pre-wrap; word-break: break-word; }
  blockquote { margin: 0 0 0 0.8rem; padding-left: 0.8rem; border-left: 3px solid #e2e2e6; color: #555; }
`;

/**
 * Sanitize raw email HTML into a self-contained document string for an iframe.
 * Always removes active content; blocks remote resources unless `allowRemote`.
 */
export function sanitizeEmailHtml(raw: string, options: SanitizeOptions = {}): SanitizeResult {
  const allowRemote = options.allowRemote ?? false;
  const doc = new DOMParser().parseFromString(raw || "", "text/html");
  let hadRemote = false;

  // 1. Drop dangerous elements entirely.
  doc.querySelectorAll(DANGEROUS_TAGS.join(",")).forEach((el) => el.remove());

  // 2. Sanitize <style> blocks (kept — emails rely on them for layout).
  doc.querySelectorAll("style").forEach((styleEl) => {
    const result = neutralizeCssRemotes(styleEl.textContent || "");
    if (!allowRemote) {
      styleEl.textContent = result.css;
      if (result.had) hadRemote = true;
    }
  });

  // 3. Walk every element: strip handlers, neutralize URLs, gate remote refs.
  doc.querySelectorAll("*").forEach((el) => {
    // event handlers (onclick, onerror, …) and dangerous bindings
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "srcdoc") {
        el.removeAttribute(attr.name);
      }
    }

    // strip dangerous schemes (javascript:, etc.) from any url-bearing attr
    for (const attrName of URL_ATTRS) {
      const value = el.getAttribute(attrName);
      if (value != null && DANGEROUS_URL.test(value)) {
        el.removeAttribute(attrName);
      }
    }

    // gate REMOTE resource loads only (images/backgrounds) — not link navigation
    if (!allowRemote) {
      for (const attrName of RESOURCE_ATTRS) {
        const value = el.getAttribute(attrName);
        if (value != null && isRemote(value)) {
          hadRemote = true;
          el.removeAttribute(attrName);
        }
      }
    }

    // srcset (img / source) — comma-separated candidate list
    const srcset = el.getAttribute("srcset");
    if (srcset != null) {
      if (!allowRemote && /(https?:)?\/\//i.test(srcset)) {
        hadRemote = true;
        el.removeAttribute("srcset");
      }
    }

    // inline style background images
    const style = el.getAttribute("style");
    if (style) {
      const result = neutralizeCssRemotes(style);
      if (!allowRemote && result.had) {
        hadRemote = true;
        el.setAttribute("style", result.css);
      }
    }

    // links open safely in a new tab
    if (el.tagName === "A" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  });

  // 4. Inject our reading reset + base into <head>, then serialize the doc.
  const head = doc.head || doc.createElement("head");
  const base = doc.createElement("base");
  base.setAttribute("target", "_blank");
  const meta = doc.createElement("meta");
  meta.setAttribute("charset", "utf-8");
  const reset = doc.createElement("style");
  reset.textContent = READING_RESET;
  head.prepend(reset);
  head.prepend(base);
  head.prepend(meta);

  return {
    html: `<!doctype html>${doc.documentElement.outerHTML}`,
    hadRemote,
  };
}

// --- plain-text formatting ----------------------------------------------------

// Zero-width and invisible spacing characters that newsletters sprinkle into the
// text/plain alternative (the mangled "‌ ‌ ‌" runs). Collapse them away.
// U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 word joiner, U+FEFF BOM.
const INVISIBLE = /[​‌‍⁠﻿]/g;
const URL_RE = /\b(https?:\/\/[^\s<>()[\]]+)/gi;

/** Clean a text/plain email body for display: drop invisible spacers, tame
 *  runaway blank lines, and normalize non-breaking spaces. */
export function cleanPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n") // trailing spaces
    .replace(/\n{3,}/g, "\n\n") // collapse big gaps
    .trim();
}

export interface TextSegment {
  text: string;
  href?: string;
}

/** Split cleaned text into plain/link segments so a component can render bare
 *  URLs as real anchors without dangerouslySetInnerHTML. */
export function linkifySegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start) });
    const url = match[0].replace(/[.,;:)\]]+$/, ""); // trailing punctuation
    segments.push({ text: url, href: url });
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}
