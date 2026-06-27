"""Route module for the mailbox app, mounted at ``/api/mailbox/`` in
config/django/urls.py. Views call backend/services/ only.

Account *settings* CRUD never returns a secret; the credential endpoint is
write-only. Folder/message endpoints connect over IMAP via the resolved account.
"""

from django.urls import path

from utils.apps.mailbox.backend.api.views import (
    AccountCredentialView,
    AccountDetailView,
    AccountFoldersView,
    AccountListCreateView,
    AccountMessageDetailView,
    AccountMessagesView,
    AccountOrganizeView,
    AccountSyncView,
    AccountTestView,
    OAuthCallbackView,
    OAuthStartView,
)

urlpatterns = [
    path("oauth/start/", OAuthStartView.as_view(), name="mailbox-oauth-start"),
    path("oauth/callback/", OAuthCallbackView.as_view(), name="mailbox-oauth-callback"),
    path("accounts/", AccountListCreateView.as_view(), name="mailbox-accounts"),
    path("accounts/<str:account_id>/", AccountDetailView.as_view(), name="mailbox-account-detail"),
    path("accounts/<str:account_id>/credential/", AccountCredentialView.as_view(), name="mailbox-account-credential"),
    path("accounts/<str:account_id>/test/", AccountTestView.as_view(), name="mailbox-account-test"),
    path("accounts/<str:account_id>/folders/", AccountFoldersView.as_view(), name="mailbox-account-folders"),
    path("accounts/<str:account_id>/messages/", AccountMessagesView.as_view(), name="mailbox-account-messages"),
    path("accounts/<str:account_id>/sync/", AccountSyncView.as_view(), name="mailbox-account-sync"),
    path("accounts/<str:account_id>/messages/<str:uid>/", AccountMessageDetailView.as_view(), name="mailbox-account-message-detail"),
    path("accounts/<str:account_id>/organize/", AccountOrganizeView.as_view(), name="mailbox-account-organize"),
]
