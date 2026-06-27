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
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "utils.apps.media_viewer.backend.apps.MediaViewerBackendConfig",
    "utils.apps.exercise.backend.apps.ExerciseBackendConfig",
    "utils.apps.projectmanager.backend.apps.ProjectManagerBackendConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
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
}

DATABASE_ROUTERS = [
    "utils.apps.exercise.backend.db_router.ExerciseRouter",
    "utils.apps.projectmanager.backend.db_router.ProjectManagerRouter",
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
    "UNAUTHENTICATED_USER": None,
}

USE_TZ = True
