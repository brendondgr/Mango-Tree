/// <reference types="vite/client" />

/*
 * The frontend has no LLM environment variables.
 *
 * `VITE_LLM_BASE_URL` / `VITE_LLM_MODEL` used to seed the browser's LLM
 * settings, back when the page talked to the model endpoint itself. Providers
 * are now configured server-side and chosen in Settings -> LLM, so a build-time
 * variable could only ever disagree with the registry.
 */
