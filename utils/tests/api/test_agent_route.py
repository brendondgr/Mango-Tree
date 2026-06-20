import json
from unittest.mock import patch

import pytest
from django.test import Client

from utils.api.routes.agent import _parse_llm_config


@pytest.mark.django_db
def test_agent_turn_accepts_null_history_content():
    client = Client()
    response = client.post(
        "/api/agent/test-session/agent_turn/",
        data=json.dumps(
            {
                "message": "follow up",
                "history": [
                    {"role": "user", "content": "hello"},
                    {"role": "agent", "content": None, "thinking": "draft"},
                ],
                "web_search_mode": "auto",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.streaming is True


@pytest.mark.django_db
def test_agent_turn_rejects_invalid_web_search_mode_gracefully():
    client = Client()
    response = client.post(
        "/api/agent/test-session/agent_turn/",
        data=json.dumps(
            {
                "message": "hello",
                "history": [],
                "web_search_mode": "always",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200


def test_parse_llm_config_sanitizes_input():
    assert _parse_llm_config(None) is None
    assert _parse_llm_config("nope") is None
    assert _parse_llm_config({}) is None
    assert _parse_llm_config({"base_url": "   ", "model": 5}) is None
    assert _parse_llm_config(
        {"base_url": " http://x/v1 ", "model": "m", "junk": 1, "api_key": "k"}
    ) == {"base_url": "http://x/v1", "model": "m", "api_key": "k"}


@pytest.mark.django_db
def test_agent_turn_threads_llm_config_into_state():
    captured = {}

    def fake_invoke(state):
        captured["state"] = state
        return state

    client = Client()
    with patch("utils.api.routes.agent.agent_graph.invoke", side_effect=fake_invoke):
        response = client.post(
            "/api/agent/test-session/agent_turn/",
            data=json.dumps(
                {
                    "message": "hello",
                    "history": [],
                    "llm_config": {
                        "base_url": "http://override/v1",
                        "model": "custom",
                        "api_key": "k",
                    },
                }
            ),
            content_type="application/json",
        )
        # Drain the SSE stream so the worker thread runs to completion.
        b"".join(response.streaming_content)

    assert captured["state"]["llm_config"] == {
        "base_url": "http://override/v1",
        "model": "custom",
        "api_key": "k",
    }
