"""Route module for the platform auth API, mounted at ``/api/auth/`` in
config/django/urls.py. Views call utils/shared/auth/services only."""

from django.urls import path

from utils.shared.auth.api.views import (
    csrf,
    login,
    logout,
    me,
    preferences,
    registration_status,
    security_attempts,
    security_lockouts,
    security_unlock,
    signup,
)

urlpatterns = [
    # Public (AllowAny) endpoints
    path("csrf/", csrf, name="auth-csrf"),
    path("registration-status/", registration_status, name="auth-registration-status"),
    path("signup/", signup, name="auth-signup"),
    path("login/", login, name="auth-login"),
    # Authenticated endpoints
    path("logout/", logout, name="auth-logout"),
    path("me/", me, name="auth-me"),
    path("preferences/", preferences, name="auth-preferences"),
    # Settings -> Security section
    path("security/attempts/", security_attempts, name="auth-security-attempts"),
    path("security/lockouts/", security_lockouts, name="auth-security-lockouts"),
    path("security/unlock/", security_unlock, name="auth-security-unlock"),
]
