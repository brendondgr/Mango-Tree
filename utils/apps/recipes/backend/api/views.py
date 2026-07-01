"""DRF views for the recipes app. Thin: validate -> service -> serialize.

Each view delegates to the same ``backend/services/`` functions the agent tools
call (API <-> agent parity). Domain logic lives only in the services."""

from __future__ import annotations

import mimetypes

from django.http import FileResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.apps.recipes.backend.api.serializers import (
    int_list,
    paginate,
    parse_object,
    str_list,
)
from utils.apps.recipes.backend.services import images as images_service
from utils.apps.recipes.backend.services import ingredients as ingredients_service
from utils.apps.recipes.backend.services import parser as parser_service
from utils.apps.recipes.backend.services import recipes as recipes_service
from utils.apps.recipes.shared.errors import RecipesError, ValidationError
from utils.apps.recipes.shared.schemas import NewRecipeDTO

_STATUS = {
    "validation_error": status.HTTP_400_BAD_REQUEST,
    "permission_denied": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
}


def _error_response(exc: RecipesError) -> Response:
    return Response(
        {"code": exc.code, "message": exc.message, "details": exc.details},
        status=_STATUS.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR),
    )


# --- recipes ------------------------------------------------------------------


class RecipeListCreateView(APIView):
    def get(self, request: Request) -> Response:
        items = [r.to_dict() for r in recipes_service.list_all()]
        return Response(paginate(request, items))

    def post(self, request: Request) -> Response:
        try:
            dto = NewRecipeDTO.from_dict(parse_object(request.data))
            created = recipes_service.create_recipe(dto)
        except RecipesError as exc:
            return _error_response(exc)
        return Response(created.to_dict(), status=status.HTTP_201_CREATED)


class RecipeFilterView(APIView):
    def post(self, request: Request) -> Response:
        try:
            payload = parse_object(request.data)
            items = recipes_service.filter_recipes(
                pantry_ids=int_list(payload.get("ingredient_ids"), field_name="ingredient_ids"),
                meal_types=str_list(payload.get("meal_types"), field_name="meal_types"),
                cuisine_regions=str_list(
                    payload.get("cuisine_regions"), field_name="cuisine_regions"
                ),
            )
        except RecipesError as exc:
            return _error_response(exc)
        return Response(paginate(request, [r.to_dict() for r in items]))


class RecipeDetailView(APIView):
    def get(self, request: Request, recipe_id: int) -> Response:
        try:
            recipe = recipes_service.get_by_id(recipe_id)
        except RecipesError as exc:
            return _error_response(exc)
        return Response(recipe.to_dict())

    def patch(self, request: Request, recipe_id: int) -> Response:
        try:
            dto = NewRecipeDTO.from_dict(parse_object(request.data))
            updated = recipes_service.update_recipe(recipe_id, dto)
        except RecipesError as exc:
            return _error_response(exc)
        return Response(updated.to_dict())

    def put(self, request: Request, recipe_id: int) -> Response:
        return self.patch(request, recipe_id)

    def delete(self, request: Request, recipe_id: int) -> Response:
        try:
            recipes_service.delete_recipe(recipe_id)
        except RecipesError as exc:
            return _error_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- ingredients + filter options ---------------------------------------------


class IngredientsView(APIView):
    def get(self, request: Request) -> Response:
        return Response(ingredients_service.by_category())


class IngredientSearchView(APIView):
    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "")
        results = ingredients_service.search(query)
        return Response([i.to_dict() for i in results])


class FilterOptionsView(APIView):
    def get(self, request: Request) -> Response:
        return Response(
            {
                "meal_types": recipes_service.distinct_meal_types(),
                "cuisine_regions": recipes_service.distinct_cuisine_regions(),
            }
        )


# --- AI Chef parser (API-only) ------------------------------------------------


class ParseRecipeView(APIView):
    def post(self, request: Request) -> Response:
        try:
            payload = parse_object(request.data)
            parsed = parser_service.parse_recipe_text(payload.get("text", ""))
        except RecipesError as exc:
            return _error_response(exc)
        return Response(parsed)


# --- images (API-only) --------------------------------------------------------


class ImageUploadView(APIView):
    def post(self, request: Request) -> Response:
        upload = request.FILES.get("image")
        if upload is None:
            return _error_response(ValidationError("No image file provided"))
        try:
            url = images_service.save_uploaded_image(upload.name, upload.read())
        except RecipesError as exc:
            return _error_response(exc)
        return Response({"success": True, "url": url}, status=status.HTTP_201_CREATED)


class ImageServeView(APIView):
    def get(self, request: Request, filename: str) -> Response:
        try:
            path = images_service.resolve_image_path(filename)
        except RecipesError as exc:
            return _error_response(exc)
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(open(path, "rb"), content_type=content_type)
