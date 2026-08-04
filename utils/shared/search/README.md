# Search

Web research behind the `search_web` core tool.

| File | Role |
| --- | --- |
| `config.py` | Loads `config/search.yaml` (SearXNG base URL, result and round limits, fetch limits) |
| `searxng_client.py` | Queries a local SearXNG instance (default `http://localhost:8080`) |
| `page_fetcher.py` | Fetches and extracts page text within the configured byte/char/timeout limits |
| `research.py` | `run_research(...)` — the multi-round search-and-read loop that returns results plus citations |

Requires a reachable SearXNG instance; without one, `search_web` fails and the
agent turn continues without web results.
