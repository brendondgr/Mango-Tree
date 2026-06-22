"""DRF views for the mailbox app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Account settings CRUD never serializes a secret; the
credential endpoint is write-only. List/messages endpoints connect over IMAP via
the resolved account.
"""

from __future__ import annotations

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

_OAUTH_KEYS = ("refresh_token", "client_id", "client_secret", "access_token")


def _credential_from_body(body: dict) -> str | dict:
    """A plain app-password string, or an OAuth bundle for Gmail/M365."""
    if any(key in body for key in _OAUTH_KEYS):
        bundle = {
            key: body[key]
            for key in _OAUTH_KEYS
            if isinstance(body.get(key), str) and body[key]
        }
        if not (bundle.get("refresh_token") or bundle.get("access_token")):
            raise ValidationError(
                "provide a refresh_token (with client_id and client_secret)",
                details={"field": "refresh_token"},
            )
        return bundle
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
        limit = _int(request.query_params.get("limit"), 25, lo=1, hi=200)
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
