# Website Architecture Setup

Mango Tree uses a frontend skeleton rather than a full UI prototype in the initial setup.

## Decisions

- Application type: Astro frontend with Svelte and React islands.
- Styling: UnoCSS plus project CSS tokens.
- Package manager: npm.
- Auth: none implemented yet; docs should reserve future local operator or admin boundaries.
- Data: static placeholder data only until runtime endpoints exist.
- API: documented contract placeholders only.
- Deployment: local development first.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
npm run check
```

## Required Docs

All website architecture changes must keep the route map, component map, data flow, deployment notes, and API contract synchronized.
