# Design System

Mango Tree uses a **swappable theme layer** on top of shadcn/ui. The default theme is Canva-inspired (see `docs/misc/canva/`). Visual tokens live in per-theme CSS files; components always consume shadcn semantic classes, never raw hex.

## Read Order

1. This file — theme architecture and shadcn bridge.
2. `docs/misc/canva/DESIGN.md` — visual intent, guardrails, component recipes.
3. `docs/misc/canva/tokens.css` — canonical hex token names for the default theme.
4. `docs/misc/canva/components.manifest.json` and `components.html` — exact selectors and states when implementing new controls.
5. `docs/misc/canva/preview/` — optional visual sanity checks.

## Theme Architecture

Themes are CSS files under `web/src/styles/themes/`. Each theme scopes shadcn variables under `[data-theme="{name}"]`. `globals.css` imports all theme files and sets a default on `:root`.

```text
web/src/styles/
  globals.css          # imports themes; base resets
  themes/
    default.css        # Canva-inspired (shipped default)
    {name}.css         # future themes — same variable contract
web/src/lib/theme.ts   # setTheme / initTheme for runtime swap
```

### Swapping at Runtime

Set `data-theme` on `<html>` via JavaScript. Persist the choice in `localStorage` so it survives reloads.

```ts
import { initTheme, setTheme } from "@/lib/theme";

// Call once at app boot (e.g. main.tsx)
initTheme();

// Settings UI or dev toggle
setTheme("default");
```

Add a new theme by:

1. Creating `web/src/styles/themes/{name}.css` with the same shadcn variable names.
2. Importing it in `globals.css`.
3. Registering `{name}` in `THEMES` inside `web/src/lib/theme.ts`.

Do not hardcode colors in components. Do not redefine tokens in feature modules.

## shadcn ↔ Canva Bridge (default theme)

shadcn expects space-separated HSL components (`hsl(var(--primary))`). The default theme maps from `docs/misc/canva/tokens.css`:

| shadcn variable | Canva source | Default HSL | Hex reference |
| --- | --- | --- | --- |
| `--background` | adapted `--bg` | `40 14% 96%` | `#f6f4f1` |
| `--foreground` | `--fg` | `210 20% 10%` | `#141a1f` |
| `--card` | elevated surface | `40 10% 99%` | `#fcfbfa` |
| `--card-foreground` | `--fg` | `210 20% 10%` | `#141a1f` |
| `--popover` | floating surface | `0 0% 100%` | `#ffffff` |
| `--popover-foreground` | `--fg` | `210 20% 10%` | `#141a1f` |
| `--primary` | `--accent` | `271 79% 54%` | `#7d2ae8` |
| `--primary-foreground` | `--accent-on` | `0 0% 100%` | `#ffffff` |
| `--secondary` | `--surface` | `40 8% 92%` | `#ebe9e5` |
| `--secondary-foreground` | `--fg` | `210 20% 10%` | `#141a1f` |
| `--muted` | inset surface | `220 10% 90%` | `#e3e5e8` |
| `--muted-foreground` | `--muted` | `210 6% 42%` | `#656b72` |
| `--accent` | Canva Cyan | `183 100% 40%` | `#00c4cc` |
| `--accent-foreground` | `--accent-on` | `0 0% 100%` | `#ffffff` |
| `--destructive` | `--danger` | `0 100% 67%` | `#ff5757` |
| `--destructive-foreground` | `--accent-on` | `0 0% 100%` | `#ffffff` |
| `--border` | `--border` | `40 7% 84%` | `#d9d6d1` |
| `--input` | `--border` | `40 7% 84%` | `#d9d6d1` |
| `--ring` | `--accent` | `271 79% 54%` | `#7d2ae8` |
| `--success` | `--success` | `168 100% 36%` | `#00b894` |

Extended brand tokens (gradient CTAs, category tags) may use raw CSS custom properties defined in the theme file (`--brand-gradient`, `--category-coral`, etc.) but only inside theme CSS or dedicated utility classes — not inline in components.

## Visual Guardrails (from Canva, adapted for Mango)

- Layered off-white surfaces dominate the operational UI (warm paper canvas, brighter cards, distinct muted/secondary tiers). Pure `#ffffff` is reserved for popovers and floating layers — a deliberate deviation from the external Canva fixture’s all-white canvas.
- Purple-to-cyan gradient is for focal moments (empty states, one primary CTA, Pro-style badges) — not every button.
- Weight contrast carries hierarchy (800→700→600→400); ink tiers stay neutral.
- Soft geometry: 8px buttons/inputs, 12px cards, 16px panels, pill chips.
- Category accent colors belong in tags and metadata, not primary chrome.
- Build operational app surfaces, not marketing landing pages.

## Fonts

Default stack from Canva tokens: `"Canva Sans", "YS Text", system-ui, -apple-system, sans-serif`. Canva Sans is not bundled in this repo; fallbacks apply until a licensed font is added. Code uses `JetBrains Mono` or `ui-monospace`.

## Icons

Keep Lucide React. Prefer rounded stroke weights; pair status icons with text labels. Filled iconography from the Canva fixture is aspirational — do not switch libraries solely for fill style.
