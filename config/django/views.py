import os

from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect

# Where the SPA is served. Django only exposes /api; the root is the frontend.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173/")


def health(_request):
    return JsonResponse({"status": "ok"})


def root_redirect(_request):
    """Bounce stray hits on the backend root to the frontend instead of 404ing."""
    return redirect(FRONTEND_URL)


def favicon(_request):
    """Backend has no favicon; answer quietly so it doesn't log a 404."""
    return HttpResponse(status=204)
