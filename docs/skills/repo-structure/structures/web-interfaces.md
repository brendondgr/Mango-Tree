# Web Interface Structure

Mango Tree's frontend lives entirely under `web/` and uses Astro as the primary app shell with Svelte and React islands. UnoCSS owns utility styling and theme tokens.

## Baseline Layout

```text
web/
|-- public/
|-- src/
|   |-- assets/
|   |-- components/
|   |   |-- feature/
|   |   |-- layout/
|   |   `-- ui/
|   |-- layouts/
|   |-- pages/
|   `-- styles/
|-- astro.config.mjs
|-- package.json
|-- tsconfig.json
`-- uno.config.ts
```

## Rules

- Route files belong in `web/src/pages/`.
- Shared chrome belongs in `web/src/components/layout/`.
- Reusable UI elements belong in `web/src/components/ui/`.
- Runtime-specific views for agents, workflows, tools, memory, and traces belong in `web/src/components/feature/`.
- Theme tokens live in `web/src/styles/theme.css`.
- Do not create a full product dashboard until route, data-flow, and API-contract docs describe the intended behavior.
