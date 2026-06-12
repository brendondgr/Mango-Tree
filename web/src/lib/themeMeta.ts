/** Theme catalog metadata — families, labels, and required CSS token contract. */

export const THEME_FAMILIES = ["mango", "blue", "fsu", "pulse"] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export const THEME_FAMILY_LABELS: Record<ThemeFamily, string> = {
  mango: "Mango",
  blue: "Blue",
  fsu: "FSU",
  pulse: "PULSE",
};

export interface ThemeMeta {
  id: string;
  label: string;
  family: ThemeFamily;
  colorScheme: "light" | "dark";
  swatches: string[];
  selfContained: boolean;
  description?: string;
}

/** shadcn core + extended tokens every theme CSS file must define. */
export const REQUIRED_THEME_CSS_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--success",
  "--brand-gradient",
  "--brand-gradient-pro",
  "--primary-hover",
  "--surface-inset",
  "--surface-cool",
  "--ink-secondary",
  "--ink-faint",
  "--warn",
  "--info",
  "--category-coral",
  "--category-tangerine",
  "--category-mint",
  "--category-sky",
  "--category-lavender",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-pill",
  "--shadow-raised",
  "--shadow-card-hover",
  "--focus-ring",
  "--motion-fast",
  "--motion-base",
  "--ease-standard",
  "--font-sans",
  "--font-mono",
] as const;

export const THEME_META_LIST: ThemeMeta[] = [
  {
    id: "default",
    label: "Mango Light",
    family: "mango",
    colorScheme: "light",
    swatches: ["#f6f4f1", "#7d2ae8", "#00c4cc"],
    selfContained: false,
    description: "Canva-inspired warm canvas with purple accents",
  },
  {
    id: "dark",
    label: "Mango Dark",
    family: "mango",
    colorScheme: "dark",
    swatches: ["#1c1f26", "#7d2ae8", "#00c4cc"],
    selfContained: false,
    description: "Blue-charcoal workspace with Mango brand accents",
  },
  {
    id: "blue-light",
    label: "Blue Light",
    family: "blue",
    colorScheme: "light",
    swatches: ["#f0f4f8", "#1e3a5f", "#38bdf8"],
    selfContained: true,
    description: "Cool blue-gray operational surfaces",
  },
  {
    id: "blue-dark",
    label: "Blue Dark",
    family: "blue",
    colorScheme: "dark",
    swatches: ["#0f172a", "#60a5fa", "#22d3ee"],
    selfContained: true,
    description: "Deep slate-blue workspace",
  },
  {
    id: "fsu-light",
    label: "FSU Light",
    family: "fsu",
    colorScheme: "light",
    swatches: ["#ffffff", "#782f40", "#ceb888"],
    selfContained: true,
    description: "FSU garnet and gold on white",
  },
  {
    id: "fsu-dark",
    label: "FSU Dark",
    family: "fsu",
    colorScheme: "dark",
    swatches: ["#101820", "#782f40", "#ceb888"],
    selfContained: true,
    description: "Stadium night surfaces with garnet and gold",
  },
  {
    id: "pulse-light",
    label: "PULSE Light",
    family: "pulse",
    colorScheme: "light",
    swatches: ["#f4f6f9", "#20588d", "#40b1d7"],
    selfContained: true,
    description: "PULSE lab blues on a light canvas",
  },
  {
    id: "pulse-dark",
    label: "PULSE Dark",
    family: "pulse",
    colorScheme: "dark",
    swatches: ["#0b0e23", "#40b1d7", "#7dd3fc"],
    selfContained: true,
    description: "PULSE navy workspace with cyan highlights",
  },
];

export const THEME_META: Record<string, ThemeMeta> = Object.fromEntries(
  THEME_META_LIST.map((meta) => [meta.id, meta]),
);

export const THEME_GROUPS: Record<ThemeFamily, ThemeMeta[]> = THEME_FAMILIES.reduce(
  (groups, family) => {
    groups[family] = THEME_META_LIST.filter((meta) => meta.family === family);
    return groups;
  },
  {} as Record<ThemeFamily, ThemeMeta[]>,
);

export function getThemeMeta(id: string): ThemeMeta | undefined {
  return THEME_META[id];
}

export function getThemeFamily(id: string): ThemeFamily {
  return getThemeMeta(id)?.family ?? "mango";
}

export function isDarkTheme(id: string): boolean {
  return getThemeMeta(id)?.colorScheme === "dark";
}

export function getPairedThemeId(id: string): string | undefined {
  const meta = getThemeMeta(id);
  if (!meta) return undefined;
  const pair = THEME_META_LIST.find(
    (candidate) =>
      candidate.family === meta.family && candidate.colorScheme !== meta.colorScheme,
  );
  return pair?.id;
}

export function toggleThemeInFamily(id: string): string {
  return getPairedThemeId(id) ?? id;
}
