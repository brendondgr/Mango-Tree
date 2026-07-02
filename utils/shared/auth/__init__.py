"""Platform authentication: single-owner session login, per-owner preferences
(enabled apps + onboarding), and the login-attempt / IP-lockout security log.

Models live on the ``default`` database (Django-owned). Business logic lives in
``services/`` and is shared by the DRF views in ``api/`` — no logic in views."""
