"""IMDbSpy app HTTP routes.

Mounted at ``/api/imdbspy/`` from ``config/django/urls.py``. Views live in
``utils/apps/imdbspy/backend/api/views.py`` and call ``backend/services/`` only.

Endpoints are added in Stage 5; this reserves the module and mount point.
"""

from __future__ import annotations

from django.urls import path

urlpatterns: list[path] = []
