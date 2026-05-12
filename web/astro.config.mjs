import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import UnoCSS from "@unocss/astro";

export default defineConfig({
  integrations: [UnoCSS(), react(), svelte()]
});
