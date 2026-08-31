import { Check, Pipette, RotateCcw } from "lucide-react";
import { useCallback, useId, useState } from "react";

import { useColorPaletteStore } from "@/app/stores/colorPaletteStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import {
  COLOR_TOKEN_LABELS,
  type ColorToken,
  hexToHslComponents,
  hslComponentsToHex,
  isEyedropperSupported,
  pickColorWithEyedropper,
  PRESET_COLOR_TOKENS,
  PRESET_PALETTES,
  readCssToken,
  SURFACE_COLOR_TOKENS,
} from "@/lib/colorPalette";
import { ColorPalettePreview } from "@/features/workspace/components/ColorPalettePreview";
import { SettingsSection } from "@/features/workspace/components/WorkspaceSettingsDialog";
import {
  THEME_FAMILIES,
  THEME_FAMILY_LABELS,
  THEME_GROUPS,
  type ThemeFamily,
  type ThemeName,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Auto-fill rather than fixed columns: this panel is one column of a split
 * dialog on a wide screen and the full width of a sheet on a phone.
 */
const AUTO_GRID = "[grid-template-columns:repeat(auto-fill,minmax(min(100%,9rem),1fr))]";

interface ThemeFamilyPickerProps {
  activeTheme: ThemeName;
  onSelect: (name: ThemeName) => void;
}

function ThemeFamilyCell({
  family,
  activeTheme,
  onSelect,
}: {
  family: ThemeFamily;
  activeTheme: ThemeName;
  onSelect: (name: ThemeName) => void;
}) {
  const variants = THEME_GROUPS[family];

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{THEME_FAMILY_LABELS[family]}</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isActive = activeTheme === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id as ThemeName)}
              className={cn(
                "flex min-h-11 min-w-[8.5rem] flex-1 items-center gap-2 rounded-[var(--radius-md)]",
                "border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "border-primary bg-primary/5",
              )}
              aria-pressed={isActive}
            >
              <span className="flex shrink-0 gap-0.5 overflow-hidden rounded-sm">
                {variant.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-5 w-3"
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block font-medium leading-tight">{variant.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {variant.colorScheme === "light" ? "Light" : "Dark"}
                </span>
              </span>
              {isActive && (
                <Check
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-primary-emphasis"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeFamilyPicker({ activeTheme, onSelect }: ThemeFamilyPickerProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "[grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]",
      )}
    >
      {THEME_FAMILIES.map((family) => (
        <ThemeFamilyCell
          key={family}
          family={family}
          activeTheme={activeTheme}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface TokenColorListProps {
  tokens: readonly ColorToken[];
  label: string;
  description?: string;
  getTokenHex: (token: ColorToken) => string;
  eyedropTarget: ColorToken | null;
  onTokenInput: (token: ColorToken, hex: string) => void;
  onEyedrop: (token: ColorToken) => void;
}

function TokenColorList({
  tokens,
  label,
  description,
  getTokenHex,
  eyedropTarget,
  onTokenInput,
  onEyedrop,
}: TokenColorListProps) {
  const listId = useId();
  const eyedropperSupported = isEyedropperSupported();

  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-medium text-foreground">{label}</h4>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid gap-3">
        {tokens.map((token) => {
          const hex = getTokenHex(token);
          const isPicking = eyedropTarget === token;
          const inputId = `${listId}-${token}`;
          return (
            <div
              key={token}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2"
            >
              {/* A real label rather than a duplicate aria-label, so the visible
                  token name is also the input's name and its hit target. */}
              <input
                id={inputId}
                type="color"
                value={hex}
                onChange={(e) => onTokenInput(token, e.target.value)}
                className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5 app:h-9 app:w-9"
              />
              <div className="min-w-0 flex-1">
                <Label htmlFor={inputId} className="block cursor-pointer">
                  {COLOR_TOKEN_LABELS[token]}
                </Label>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{hex}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!eyedropperSupported || isPicking}
                onClick={() => onEyedrop(token)}
                aria-label={`Pick ${COLOR_TOKEN_LABELS[token]} from screen`}
                title={
                  eyedropperSupported
                    ? "Pick color from screen"
                    : "Eyedropper not supported in this browser"
                }
              >
                <Pipette className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ColorPalettePanel() {
  const { theme, themeMeta, setTheme } = useTheme();
  const isMangoTheme = themeMeta?.family === "mango";
  const activePresetId = useColorPaletteStore((s) => s.activePresetId);
  const overrides = useColorPaletteStore((s) => s.overrides);
  const applyPreset = useColorPaletteStore((s) => s.applyPreset);
  const setTokenColor = useColorPaletteStore((s) => s.setTokenColor);
  const resetPalette = useColorPaletteStore((s) => s.resetPalette);

  const [eyedropTarget, setEyedropTarget] = useState<ColorToken | null>(null);
  const [eyedropError, setEyedropError] = useState<string | null>(null);

  const getTokenHex = useCallback(
    (token: ColorToken): string => {
      const components = overrides[token] ?? readCssToken(token);
      return hslComponentsToHex(components) ?? "#000000";
    },
    [overrides],
  );

  const handleTokenInput = (token: ColorToken, hex: string) => {
    const hsl = hexToHslComponents(hex);
    if (hsl) setTokenColor(token, hsl);
  };

  const handleEyedrop = async (token: ColorToken) => {
    setEyedropError(null);
    setEyedropTarget(token);
    const hex = await pickColorWithEyedropper();
    setEyedropTarget(null);
    if (!hex) {
      if (!isEyedropperSupported()) {
        setEyedropError("Eyedropper is not supported in this browser. Use the color picker instead.");
      }
      return;
    }
    const hsl = hexToHslComponents(hex);
    if (hsl) setTokenColor(token, hsl);
  };

  // Plain flow, no nested scrollers: the panel used to hide half of itself
  // (preview, accent colors, surface colors and reset) inside two fixed-height
  // scroll areas that had no height to scroll below the two-column breakpoint.
  return (
    <div className="grid items-start gap-6 app:grid-cols-2 app:gap-8">
      <div className="grid gap-6">
        <SettingsSection
          title="Base theme"
          description="The light or dark foundation every palette builds on."
        >
          <ThemeFamilyPicker activeTheme={theme} onSelect={setTheme} />
        </SettingsSection>

        <SettingsSection
          title="Preset palettes"
          description={
            isMangoTheme
              ? "Curated accent sets. Applying one replaces your accent colors."
              : "Preset palettes apply to the Mango base theme only."
          }
        >
          <div className={cn("grid gap-2", AUTO_GRID)}>
            {PRESET_PALETTES.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!isMangoTheme}
                  aria-pressed={isActive}
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-border",
                    "p-3 text-center transition-colors hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                    isActive && "border-primary bg-primary/5",
                  )}
                >
                  <span className="flex shrink-0 gap-0.5 overflow-hidden rounded-md">
                    {preset.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-8 w-5"
                        style={{ backgroundColor: swatch }}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {preset.name}
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-primary-emphasis" aria-hidden />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsSection>
      </div>

      <div className="grid gap-6">
        <SettingsSection
          title="Preview"
          description="Where each token lands in real chrome."
        >
          <ColorPalettePreview />
        </SettingsSection>

        <SettingsSection
          title="Custom colors"
          description="Override a single token. Changes apply live."
          action={
            <Button type="button" variant="ghost" onClick={resetPalette}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset colors
            </Button>
          }
        >
          <TokenColorList
            tokens={PRESET_COLOR_TOKENS}
            label="Accent colors"
            getTokenHex={getTokenHex}
            eyedropTarget={eyedropTarget}
            onTokenInput={handleTokenInput}
            onEyedrop={handleEyedrop}
          />
          <TokenColorList
            tokens={SURFACE_COLOR_TOKENS}
            label="Surface colors"
            description="From the light/dark base theme. Override only for testing."
            getTokenHex={getTokenHex}
            eyedropTarget={eyedropTarget}
            onTokenInput={handleTokenInput}
            onEyedrop={handleEyedrop}
          />
          {eyedropError && (
            <p className="text-xs text-muted-foreground" role="status">
              {eyedropError}
            </p>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
