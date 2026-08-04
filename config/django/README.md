# Django Configuration

| File | Role |
| --- | --- |
| `settings.py` | Single settings module — no dev/prod split. Databases, DRF defaults, cookie and CSRF security |
| `urls.py` | Root URLconf: root redirect, favicon, `/api/health/`, and one include per app under `/api/` |
| `views.py` | `root_redirect`, `favicon`, `health` |
| `asgi.py`, `wsgi.py` | Server entry points |

Everything is environment-driven: `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`,
`DJANGO_COOKIE_SECURE`, `DJANGO_SESSION_COOKIE_AGE`,
`DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_BEHIND_TLS_PROXY`, and the per-app
`MANGO_*_DB` paths.

Two settings are easy to get wrong:

- **`DJANGO_COOKIE_SECURE`** defaults to `not DEBUG`. Running with `DEBUG=false`
  over plain http therefore drops the session cookie and login never sticks —
  set it to `false` explicitly for non-TLS deployments.
- **CSRF trusted origins** auto-include `localhost`/`127.0.0.1` on ports
  5173–5182 when cookies are not Secure, so Vite's fallback ports work in
  development. The Vite `/api` proxy sets `changeOrigin: false` to keep the Host
  header intact for this check.

See `config/README.md` for the YAML files and database layout.
