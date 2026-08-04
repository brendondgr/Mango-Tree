# Memory

**Placeholder — not implemented.** This package is empty and nothing imports it.

The intended role is short-term memory, vector memory, namespacing, and
retrieval policies. Today a turn's only context is the `messages` list the
frontend sends with each request, plus the observations accumulated within that
single turn. Nothing persists between turns on the server.

Do not document memory behaviour as if it exists.
