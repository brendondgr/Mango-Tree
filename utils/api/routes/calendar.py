"""Calendar app HTTP routes.

Mounted at ``/api/calendar/`` from ``config/django/urls.py``. Views live in
``utils/apps/calendar/backend/api/views.py`` and call ``backend/services/`` only.

Reserved during Stage 2 scaffolding; endpoints are added in Stage 5.
"""

from django.urls import path

urlpatterns: list[path] = []
