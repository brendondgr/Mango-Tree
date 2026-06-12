import { Check, Pipette, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

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
import { THEMES, type ThemeName } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<ThemeName, string> = {
  dark: "Dark",
  default: "Light",
};

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
  const { theme, setTheme } = useTheme();
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
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Label>Base theme</Label>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((name) => (
            <Button
              key={name}
              type="button"
              variant={theme === name ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(name)}
            >
              {THEME_LABELS[name]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Light and dark control page surfaces. Preset palettes only change accent
          colors on top.
        </p>
      </div>

      <div className="grid gap-3">
        <Label>Preset palettes</Label>
        <p className="text-xs text-muted-foreground">
          Accent colors only — primary, highlight, and focus ring. Surfaces stay
          on the base theme above.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESET_PALETTES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "flex items-start gap-3 rounded-[var(--radius-md)] border border-border p-3 text-left transition-colors hover:bg-muted/50",
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
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  {preset.name}
                  {activePresetId === preset.id && (
                    <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <Label>Preview</Label>
        <ColorPalettePreview />
        <p className="text-xs text-muted-foreground">
          Surfaces follow the base theme; accent regions map to preset tokens below.
        </p>
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
  );
}
