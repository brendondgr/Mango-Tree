# Providers

`llm.py` — one `requests`-based client (`chat_complete`) for any
OpenAI-compatible `/v1/chat/completions` endpoint, with streaming and per-request
`base_url` / `model` / `api_key` overrides. This is what the coordinator calls.

Defaults come from `config/models.yaml` and the `LLM_*` environment variables
(`LLM_BASE_URL`, default `http://localhost:9090/v1`).

There is no provider class hierarchy and no separate local-vs-cloud
implementation — "local" and "cloud" are just different base URLs handed to the
same client. `utils/shared/llm/` holds an older non-streaming client that the
agent loop does not use.
