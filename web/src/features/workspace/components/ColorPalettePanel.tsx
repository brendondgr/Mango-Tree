import { Check, Pipette, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

import { useColorPaletteStore } from "@/app/stores/colorPaletteStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  THEME_FAMILY_LABELS,
  THEME_GROUPS,
  type ThemeFamily,
  type ThemeName,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_FAMILY_ROWS: ThemeFamily[][] = [
  ["mango", "blue"],
  ["fsu", "pulse"],
];

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
                "flex min-w-[8.5rem] items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
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
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
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
    <div className="grid gap-4 sm:grid-cols-2">
      {THEME_FAMILY_ROWS.flat().map((family) => (
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
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid gap-3">
        {tokens.map((token) => {
          const hex = getTokenHex(token);
          const isPicking = eyedropTarget === token;
          return (
            <div
              key={token}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2"
            >
              <input
                type="color"
                value={hex}
                onChange={(e) => onTokenInput(token, e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                aria-label={`${COLOR_TOKEN_LABELS[token]} color picker`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{COLOR_TOKEN_LABELS[token]}</p>
                <p className="font-mono text-xs text-muted-foreground">{hex}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!isEyedropperSupported() || isPicking}
                onClick={() => onEyedrop(token)}
                aria-label={`Pick ${COLOR_TOKEN_LABELS[token]} from screen`}
                title={
                  isEyedropperSupported()
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

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <ScrollArea className="min-h-0 lg:max-h-none">
        <div className="grid gap-6 pr-2 lg:pr-4">
          <div className="grid gap-3">
            <Label>Base theme</Label>
            <ThemeFamilyPicker activeTheme={theme} onSelect={setTheme} />
          </div>

          <div className="grid gap-3">
            <Label>Preset palettes</Label>
            <div
              className={cn(
                "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
                !isMangoTheme && "pointer-events-none opacity-50",
              )}
            >
              {PRESET_PALETTES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-border p-3 text-center transition-colors hover:bg-muted/50",
                    activePresetId === preset.id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex shrink-0 gap-0.5 overflow-hidden rounded-md">
                    {preset.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-8 w-5"
                        style={{ backgroundColor: swatch }}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {preset.name}
                    {activePresetId === preset.id && (
                      <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 pr-2 lg:pr-0">
          <div className="grid gap-3">
            <Label>Preview</Label>
            <ColorPalettePreview />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Custom colors</Label>
              <Button type="button" variant="ghost" size="sm" onClick={resetPalette}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset colors
              </Button>
            </div>
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
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
