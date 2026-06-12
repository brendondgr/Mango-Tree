export type CodeBlockAccent =
  | "coral"
  | "tangerine"
  | "mint"
  | "sky"
  | "lavender"
  | "primary"
  | "accent"
  | "info"
  | "warn";

const FALLBACK_ACCENTS: CodeBlockAccent[] = [
  "mint",
  "sky",
  "lavender",
  "tangerine",
  "coral",
];

const LANGUAGE_ACCENT: Record<string, CodeBlockAccent> = {
  bash: "coral",
  c: "sky",
  cpp: "sky",
  "c++": "sky",
  csharp: "lavender",
  cs: "lavender",
  css: "sky",
  docker: "info",
  dockerfile: "info",
  go: "accent",
  golang: "accent",
  graphql: "lavender",
  html: "tangerine",
  java: "coral",
  javascript: "tangerine",
  js: "tangerine",
  jsx: "tangerine",
  json: "lavender",
  kotlin: "coral",
  markdown: "primary",
  md: "primary",
  php: "lavender",
  powershell: "info",
  ps1: "info",
  python: "mint",
  py: "mint",
  ruby: "coral",
  rb: "coral",
  rust: "coral",
  rs: "coral",
  sh: "coral",
  shell: "coral",
  sql: "info",
  swift: "tangerine",
  toml: "lavender",
  ts: "sky",
  tsx: "sky",
  typescript: "sky",
  txt: "primary",
  text: "primary",
  xml: "tangerine",
  yaml: "lavender",
  yml: "lavender",
  zsh: "coral",
};

const LANGUAGE_LABEL: Record<string, string> = {
  bash: "Bash",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  cs: "C#",
  dockerfile: "Dockerfile",
  golang: "Go",
  graphql: "GraphQL",
  javascript: "JavaScript",
  js: "JavaScript",
  jsx: "JSX",
  json: "JSON",
  markdown: "Markdown",
  md: "Markdown",
  php: "PHP",
  powershell: "PowerShell",
  ps1: "PowerShell",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  rs: "Rust",
  rust: "Rust",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  txt: "Plain text",
  text: "Plain text",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  zsh: "Zsh",
};

const ACCENT_STYLES: Record<
  CodeBlockAccent,
  { border: string; header: string; badge: string; rail: string }
> = {
  coral: {
    border: "border-[hsl(var(--category-coral)/0.35)]",
    header: "bg-[hsl(var(--category-coral)/0.12)]",
    badge: "text-[hsl(var(--category-coral))]",
    rail: "bg-[hsl(var(--category-coral))]",
  },
  tangerine: {
    border: "border-[hsl(var(--category-tangerine)/0.35)]",
    header: "bg-[hsl(var(--category-tangerine)/0.12)]",
    badge: "text-[hsl(var(--category-tangerine))]",
    rail: "bg-[hsl(var(--category-tangerine))]",
  },
  mint: {
    border: "border-[hsl(var(--category-mint)/0.35)]",
    header: "bg-[hsl(var(--category-mint)/0.12)]",
    badge: "text-[hsl(var(--category-mint))]",
    rail: "bg-[hsl(var(--category-mint))]",
  },
  sky: {
    border: "border-[hsl(var(--category-sky)/0.35)]",
    header: "bg-[hsl(var(--category-sky)/0.12)]",
    badge: "text-[hsl(var(--category-sky))]",
    rail: "bg-[hsl(var(--category-sky))]",
  },
  lavender: {
    border: "border-[hsl(var(--category-lavender)/0.35)]",
    header: "bg-[hsl(var(--category-lavender)/0.12)]",
    badge: "text-[hsl(var(--category-lavender))]",
    rail: "bg-[hsl(var(--category-lavender))]",
  },
  primary: {
    border: "border-primary/30",
    header: "bg-primary/10",
    badge: "text-primary",
    rail: "bg-primary",
  },
  accent: {
    border: "border-accent/30",
    header: "bg-accent/10",
    badge: "text-accent",
    rail: "bg-accent",
  },
  info: {
    border: "border-[hsl(var(--info)/0.35)]",
    header: "bg-[hsl(var(--info)/0.12)]",
    badge: "text-[hsl(var(--info))]",
    rail: "bg-[hsl(var(--info))]",
  },
  warn: {
    border: "border-[hsl(var(--warn)/0.35)]",
    header: "bg-[hsl(var(--warn)/0.12)]",
    badge: "text-[hsl(var(--warn))]",
    rail: "bg-[hsl(var(--warn))]",
  },
};

export function normalizeLanguage(language: string | undefined): string {
  if (!language) {
    return "text";
  }

  const normalized = language
    .replace(/^language-/, "")
    .trim()
    .toLowerCase();

  return normalized || "text";
}

export function accentForLanguage(language: string): CodeBlockAccent {
  const normalized = normalizeLanguage(language);

  if (LANGUAGE_ACCENT[normalized]) {
    return LANGUAGE_ACCENT[normalized];
  }

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index)) % FALLBACK_ACCENTS.length;
  }

  return FALLBACK_ACCENTS[hash] ?? "primary";
}

export function labelForLanguage(language: string): string {
  const normalized = normalizeLanguage(language);
  return (
    LANGUAGE_LABEL[normalized] ??
    normalized.charAt(0).toUpperCase() + normalized.slice(1)
  );
}

export function stylesForAccent(accent: CodeBlockAccent) {
  return ACCENT_STYLES[accent];
}
