# Auth

Platform authentication and account security. Django app `mango_auth` (models on
the `default` database); business logic in `services/`, DRF surface in `api/`
mounted at `/api/auth/` via `utils/api/routes/auth.py`.

The platform is **single-owner**: `/signup` creates the one owner account and
then closes. Login uses Django sessions in an httpOnly cookie; DRF defaults every
endpoint to `IsAuthenticated`, so the whole API is gated except the public auth
and health routes.

- `models.py` — `UserPreferences` (per-owner `enabled_apps` + `onboarding_completed`),
  `LoginAttempt` (append-only audit log).
- `services/accounts.py` — owner signup/credentials, preferences read/update.
- `services/lockout.py` — attempt logging and per-IP lockout after repeated
  failures (thresholds via `MANGO_AUTH_*`), with manual unlock.

Endpoints and the CSRF/session contract are documented in `docs/api.md`
(Authentication) and `docs/platform.md` (Authentication & Security).
