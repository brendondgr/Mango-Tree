""""AI Chef" recipe-text parser. Turns pasted free-form recipe text into a
structured recipe dict using the platform's shared OpenAI-compatible LLM client
(``utils.shared.llm``), driven by the ``LLM_BASE_URL`` / ``LLM_MODEL`` /
``LLM_API_KEY`` configuration. API-only — the agent creates recipes directly with
structured data and has no need for this surface."""

from __future__ import annotations

import json
from typing import Any

from utils.apps.recipes.shared.errors import RecipesError, ValidationError
from utils.shared.llm import (
    LlmClientError,
    OpenAICompatibleClient,
    load_llm_config,
)

SYSTEM_PROMPT = (
    "You are a culinary data extraction expert. Your task is to parse raw recipe "
    "text into a strict JSON format. Return ONLY the JSON object, no markdown "
    "formatting or other text. The JSON structure must be: "
    "{"
    '  "title": "string", '
    '  "description": "string", '
    '  "servings": "integer or string", '
    '  "cuisine": "string (e.g., Italian, Mexican)", '
    '  "meal_type": "string (e.g., Dinner, Snack)", '
    '  "ingredients": ['
    '    {"name": "string", "quantity": "float or string", "unit": "string", "is_optional": boolean}'
    "  ], "
    '  "steps": ["string", "string", ...]'
    "}"
    "For ingredients, every word in the 'name' must be capitalized (Title Case). "
    "Try to normalize quantities to numbers where possible. "
    "For is_optional, set to true if the ingredient is listed as optional."
)


def _strip_code_fences(content: str) -> str:
    content = content.strip()
    if content.startswith("```json"):
        content = content[len("```json") :]
    elif content.startswith("```"):
        content = content[len("```") :]
    if content.endswith("```"):
        content = content[: -len("```")]
    return content.strip()


def parse_recipe_text(text: str, *, client: OpenAICompatibleClient | None = None) -> dict[str, Any]:
    """Parse ``text`` into a structured recipe dict, or raise a typed error."""
    if not text or not text.strip():
        raise ValidationError("No recipe text provided", details={"field": "text"})

    client = client or OpenAICompatibleClient(load_llm_config())
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Parse this recipe:\n\n{text}"},
    ]

    try:
        content = client.chat(messages)
    except LlmClientError as exc:
        raise RecipesError(f"Recipe parser is unavailable: {exc}") from exc

    try:
        parsed = json.loads(_strip_code_fences(content))
    except (json.JSONDecodeError, TypeError) as exc:
        raise RecipesError("The recipe parser returned invalid JSON") from exc

    if not isinstance(parsed, dict):
        raise RecipesError("The recipe parser returned an unexpected shape")
    return parsed
