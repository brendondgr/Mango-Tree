import json

import pytest
from django.test import Client


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
