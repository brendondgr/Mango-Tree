from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]

# Load .env from the repo root so app-specific vars (STRAVA_*, MANGO_*) are
# available before any os.environ.get() call below.
load_dotenv(BASE_DIR / ".env", override=False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-not-for-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"


def _csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# Public deployments must pin the hostnames they answer to. Override via
# DJANGO_ALLOWED_HOSTS (comma separated) in production, e.g. "mango.example.com".
ALLOWED_HOSTS = _csv_env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "utils.shared.auth.apps.MangoAuthConfig",
    "utils.apps.media_viewer.backend.apps.MediaViewerBackendConfig",
    "utils.apps.exercise.backend.apps.ExerciseBackendConfig",
    "utils.apps.projectmanager.backend.apps.ProjectManagerBackendConfig",
    "utils.apps.imdbspy.backend.apps.ImdbspyBackendConfig",
    "utils.apps.timekeeper.backend.apps.TimekeeperBackendConfig",
    "utils.apps.recipes.backend.apps.RecipesBackendConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

ROOT_URLCONF = "config.django.urls"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / ".django-test.sqlite3",
    },
    # Legacy WorkoutTracker SQLite store, bound read/write with managed=False
    # models. Schema and rows are preserved unchanged (Strategy A). Override the
    # path with MANGO_EXERCISE_DB for tests or alternate deployments.
    "exercise": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MANGO_EXERCISE_DB") or str(
            BASE_DIR / "data" / "exercise" / "workouttracker.db"
        ),
    },
    # Legacy ProjectManager SQLite store, bound read/write with managed=False
    # models. Schema and rows are preserved unchanged (Strategy A). Override the
    # path with MANGO_PROJECTMANAGER_DB for tests or alternate deployments.
    "projectmanager": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MANGO_PROJECTMANAGER_DB") or str(
            BASE_DIR / "data" / "projectmanager" / "projectmanager.db"
        ),
    },
    # Dedicated IMDbSpy SQLite store. Unlike exercise/projectmanager, Django
    # owns this schema (managed=True models) — created by
    # `migrate --database=imdbspy`. Override the path with MANGO_IMDBSPY_DB for
    # tests or alternate deployments.
    "imdbspy": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MANGO_IMDBSPY_DB") or str(
            BASE_DIR / "data" / "imdbspy" / "imdbtracker.db"
        ),
    },
    # Legacy TimeKeeper SQLite store, bound read/write with managed=False models.
    # Schema and rows are preserved unchanged (Strategy A). Override the path with
    # MANGO_TIMEKEEPER_DB for tests or alternate deployments.
    "timekeeper": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MANGO_TIMEKEEPER_DB") or str(
            BASE_DIR / "data" / "timekeeper" / "timekeeper.db"
        ),
    },
    # Recipes SQLite store, bound read/write with managed=False models. The
    # schema (recipes/ingredients/recipe_ingredients/steps/recipe_images) is
    # owned by backend/services/store.py and seeded on first run. Override the
    # path with MANGO_RECIPES_DB for tests or alternate deployments.
    "recipes": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MANGO_RECIPES_DB") or str(
            BASE_DIR / "data" / "recipes" / "recipes.db"
        ),
    },
}

DATABASE_ROUTERS = [
    "utils.apps.exercise.backend.db_router.ExerciseRouter",
    "utils.apps.projectmanager.backend.db_router.ProjectManagerRouter",
    "utils.apps.imdbspy.backend.db_router.ImdbspyRouter",
    "utils.apps.timekeeper.backend.db_router.TimekeeperRouter",
    "utils.apps.recipes.backend.db_router.RecipesRouter",
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    # The platform is single-owner and gated: authenticate every request against
    # the session cookie and require a logged-in user by default. Public
    # endpoints (login, signup, csrf, health) opt out with AllowAny.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# --- Authentication & session security ---------------------------------------
# Session cookies (httpOnly, so JavaScript cannot exfiltrate them) are the
# credential; CSRF protects state-changing requests. Cookies go Secure whenever
# DEBUG is off so a public https deployment never leaks them over plain http.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_COOKIE_AGE = int(os.environ.get("DJANGO_SESSION_COOKIE_AGE", 60 * 60 * 24 * 14))

# The CSRF cookie must be readable by the SPA so it can echo the token back in
# the X-CSRFToken header, so it is deliberately NOT httpOnly.
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = _csv_env("DJANGO_CSRF_TRUSTED_ORIGINS", "")

# Behind a TLS-terminating reverse proxy (the public mango.* deployment), trust
# the forwarded-proto header so Django knows the request arrived over https.
if os.environ.get("DJANGO_BEHIND_TLS_PROXY", "false").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Hardened response headers.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

USE_TZ = True
