"""DRF views for the mailbox app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Account settings CRUD never serializes a secret; the
credential endpoint is write-only. List/messages endpoints connect over IMAP via
the resolved account.
"""

from __future__ import annotations

import os

from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.mailbox.backend.api.serializers import (
    paginate,
    parse_object,
    serialize_account,
)
from utils.apps.mailbox.backend.services import config_store
from utils.apps.mailbox.backend.services import mailops as mailops_service
from utils.apps.mailbox.backend.services import messages as messages_service
from utils.apps.mailbox.backend.services import providers as providers_service
from utils.apps.mailbox.backend.services import secrets
from utils.apps.mailbox.backend.services.oauth import flow as oauth_flow
from utils.apps.mailbox.backend.services.oauth.pending import FilePendingStore
from utils.apps.mailbox.shared.errors import MailError, ValidationError

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
    "provider_error": status.HTTP_502_BAD_GATEWAY,
}


def _error_response(exc: MailError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


def _int(value, default: int, *, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


def _default_credential_ref(provider: str, account_id: str) -> str:
    return f"MAIL_{provider.upper()}_{account_id.upper()}"


# --- accounts (settings) ------------------------------------------------------

class AccountListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [serialize_account(a) for a in config_store.list_accounts()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            account = config_store.save_account(parse_object(request.data))
        except MailError as exc:
            return _error_response(exc)
        return Response(serialize_account(account), status=status.HTTP_201_CREATED)


class AccountDetailView(APIView):
    def put(self, request: Request, account_id: str) -> Response:
        try:
            body = parse_object(request.data)
            body["id"] = account_id  # upsert on the URL id
            account = config_store.save_account(body)
        except MailError as exc:
            return _error_response(exc)
        return Response(serialize_account(account), status=status.HTTP_200_OK)

    def delete(self, request: Request, account_id: str) -> Response:
        try:
            account = config_store.get_account(account_id)
            config_store.delete_account(account_id)
            if account.credential_ref:
                secrets.delete_credential(account.credential_ref)
        except MailError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- credential (write-only) --------------------------------------------------

def _credential_from_body(body: dict) -> str:
    """An app password (Yahoo/Exchange). Gmail/M365 credentials are obtained via
    the OAuth portal (``/oauth/start`` -> ``/oauth/callback``), not pasted here."""
    value = body.get("value") or body.get("credential")
    if not isinstance(value, str) or not value:
        raise ValidationError("credential value is required", details={"field": "value"})
    return value


class AccountCredentialView(APIView):
    def put(self, request: Request, account_id: str) -> Response:
        try:
            account = config_store.get_account(account_id)  # 404 if missing
            credential = _credential_from_body(parse_object(request.data))
            ref = account.credential_ref or _default_credential_ref(account.provider, account.id)
            secrets.set_credential(ref, credential)
            if account.credential_ref != ref:
                config_store.save_account({**account.to_dict(), "credential_ref": ref})
        except MailError as exc:
            return _error_response(exc)
        # Write-only: never echo the secret. The ref is a key name and is safe.
        return Response(
            {"id": account_id, "credential_ref": ref, "has_credential": True},
            status=status.HTTP_200_OK,
        )


class AccountTestView(APIView):
    def post(self, request: Request, account_id: str) -> Response:
        try:
            result = providers_service.test_account(account_id)
        except MailError as exc:
            return _error_response(exc)
        return Response(result, status=status.HTTP_200_OK)


# --- OAuth portal (Gmail / M365) ----------------------------------------------

def _redirect_uri(request: Request) -> str:
    """Where the provider sends the user back — must exactly match the URI
    registered with the provider. Overridable via env for hosted deployments."""
    override = os.environ.get("MANGO_MAILBOX_OAUTH_REDIRECT")
    return override or request.build_absolute_uri("/api/mailbox/oauth/callback/")


def _return_url(*, account_id: str | None = None, error: str | None = None) -> str:
    """Where to send the browser after the callback (the SPA)."""
    base = os.environ.get("MANGO_MAILBOX_OAUTH_RETURN", "/")
    sep = "&" if "?" in base else "?"
    if account_id:
        return f"{base}{sep}mailbox_added={account_id}"
    if error:
        return f"{base}{sep}mailbox_error={error}"
    return base


class OAuthStartView(APIView):
    """Begin the portal flow: return the provider authorize URL for the SPA to open."""

    def get(self, request: Request) -> Response:
        provider = request.query_params.get("provider", "")
        try:
            url = oauth_flow.build_authorize_url(provider, _redirect_uri(request), FilePendingStore())
        except MailError as exc:
            return _error_response(exc)
        return Response({"authorize_url": url}, status=status.HTTP_200_OK)


class OAuthCallbackView(APIView):
    """Provider redirect target: validate state, exchange the code, create the
    account, then bounce the browser back to the SPA."""

    def get(self, request: Request) -> HttpResponseRedirect:
        if request.query_params.get("error"):
            return HttpResponseRedirect(_return_url(error=request.query_params["error"]))
        state = request.query_params.get("state", "")
        code = request.query_params.get("code", "")
        pending = FilePendingStore().take(state)
        if not pending or not code:
            return HttpResponseRedirect(_return_url(error="invalid_state"))
        try:
            account = oauth_flow.complete_login(
                pending, code, config_store=config_store, secrets=secrets
            )
        except MailError as exc:
            return HttpResponseRedirect(_return_url(error=exc.code))
        return HttpResponseRedirect(_return_url(account_id=account["id"]))


# --- folders + messages (IMAP reads) ------------------------------------------

class AccountFoldersView(APIView):
    def get(self, request: Request, account_id: str) -> Response:
        try:
            tree = messages_service.list_folders(account_id)
        except MailError as exc:
            return _error_response(exc)
        return Response(tree, status=status.HTTP_200_OK)


class AccountMessagesView(APIView):
    def get(self, request: Request, account_id: str) -> Response:
        folder = request.query_params.get("folder", "INBOX")
        raw_limit = request.query_params.get("limit")
        # `limit=all` (or `0`) fetches every message in the folder; otherwise a
        # bounded count. None flows through to the service as "fetch all".
        if raw_limit in ("all", "0"):
            limit: int | None = None
        else:
            limit = _int(raw_limit, 25, lo=1, hi=2000)
        try:
            items = messages_service.list_messages(account_id, folder=folder, limit=limit)
        except MailError as exc:
            return _error_response(exc)
        return Response(
            {"messages": [m.to_dict() for m in items], "count": len(items), "folder": folder},
            status=status.HTTP_200_OK,
        )


class AccountMessageDetailView(APIView):
    def get(self, request: Request, account_id: str, uid: str) -> Response:
        folder = request.query_params.get("folder", "INBOX")
        try:
            message = messages_service.get_message(account_id, uid=uid, folder=folder)
        except MailError as exc:
            return _error_response(exc)
        return Response(message.to_dict(), status=status.HTTP_200_OK)


# --- mutations (organize / create folder / send) ------------------------------

class AccountOrganizeView(APIView):
    """Move a message by UID. Reversible, so not confirm-gated."""

    def post(self, request: Request, account_id: str) -> Response:
        body = parse_object(request.data) if isinstance(request.data, dict) else {}
        try:
            result = mailops_service.organize(
                account_id,
                uid=str(body.get("uid", "")),
                dest=str(body.get("dest", "")),
                source=str(body.get("source", "INBOX")),
                create_if_missing=bool(body.get("create_if_missing", True)),
            )
        except MailError as exc:
            return _error_response(exc)
        return Response(result, status=status.HTTP_200_OK)
