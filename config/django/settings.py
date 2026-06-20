from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-not-for-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "utils.apps.media_viewer.backend.apps.MediaViewerBackendConfig",
    "utils.apps.exercise.backend.apps.ExerciseBackendConfig",
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
        "NAME": os.environ.get(
            "MANGO_EXERCISE_DB",
            str(BASE_DIR / "data" / "exercise" / "workouttracker.db"),
        ),
    },
}

DATABASE_ROUTERS = ["utils.apps.exercise.backend.db_router.ExerciseRouter"]

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
