from unittest.mock import MagicMock, patch

from utils.agents.providers import llm
from utils.agents.providers.llm import _resolve_config, chat_complete


def test_resolve_config_falls_back_to_env_defaults():
    resolved = _resolve_config(None)
    assert resolved["base_url"] == llm.LLM_BASE_URL
    assert resolved["model"] == llm.LLM_MODEL
    assert resolved["api_key"] == llm.LLM_API_KEY


def test_resolve_config_applies_overrides_and_trims():
    resolved = _resolve_config(
        {"base_url": " http://example.com:1234/v1/ ", "model": " gpt ", "api_key": " k "}
    )
    assert resolved["base_url"] == "http://example.com:1234/v1"
    assert resolved["model"] == "gpt"
    assert resolved["api_key"] == "k"


def test_resolve_config_ignores_blank_and_non_string_fields():
    resolved = _resolve_config({"base_url": "   ", "model": None, "api_key": 5})
    assert resolved["base_url"] == llm.LLM_BASE_URL
    assert resolved["model"] == llm.LLM_MODEL
    assert resolved["api_key"] == llm.LLM_API_KEY


@patch("utils.agents.providers.llm.requests.post")
def test_chat_complete_uses_config_override(mock_post):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"ok": True}
    mock_post.return_value = response

    chat_complete(
        [{"role": "user", "content": "hi"}],
        config={
            "base_url": "http://override:9999/v1",
            "model": "custom-model",
            "api_key": "secret",
        },
    )

    args, kwargs = mock_post.call_args
    assert args[0] == "http://override:9999/v1/chat/completions"
    assert kwargs["json"]["model"] == "custom-model"
    assert kwargs["headers"]["Authorization"] == "Bearer secret"


@patch("utils.agents.providers.llm.requests.post")
def test_chat_complete_without_config_uses_env_defaults(mock_post):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"ok": True}
    mock_post.return_value = response

    chat_complete([{"role": "user", "content": "hi"}])

    args, kwargs = mock_post.call_args
    assert args[0] == f"{llm.LLM_BASE_URL}/chat/completions"
    assert kwargs["json"]["model"] == llm.LLM_MODEL
