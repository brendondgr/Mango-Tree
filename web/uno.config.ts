import { defineConfig, presetIcons, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3(), presetIcons()],
  theme: {
    colors: {
      pulse: {
        bg: "var(--bg-color)",
        secondary: "var(--bg-secondary)",
        surface: "var(--surface-color)",
        text: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        light: "var(--accent-light)",
        dark: "var(--accent-dark)",
        border: "var(--border-color)"
      }
    }
  }
});
