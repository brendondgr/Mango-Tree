# Deployment

Mango Tree is local-first. Deployment guidance currently covers local development only.

## Python Runtime

Use `uv`:

```bash
uv run read-yaml.py
```

Future runtime commands should be added when `src/agent_runtime/` exists.

## Frontend

Use npm from `web/`:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run check
```

No Docker requirement is defined yet.
