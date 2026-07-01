from __future__ import annotations

# Planner-facing guidance for the IMDbSpy tools. Each tool calls the same service
# as the matching /api/imdbspy/ endpoint.
IMDBSPY_TOOLS_PROMPT = """\
IMDbSpy movie/TV tracker tools:

Read first to ground answers:
- imdbspy_list_media — the user's tracked titles. Filter by `status`
  (seen/not_seen/abandoned), `kind` ("movie" or "tv"), or a `search` string
  (title/genre/cast/crew). Returns {items, total, has_more}; each item has an
  integer `id`, `imdb_id`, `title`, `kind`, `status`, and (if reviewed) a
  `user_rating` on a 0-10 scale.

Write:
- imdbspy_add_media — add titles by IMDb URL or ID (`urls` is a list). Metadata
  and images are scraped, so this makes network calls. Returns {added, errors};
  per-title `errors` carry a `code` (`conflict` = already tracked, others as
  noted). Reuse the exact `imdb_id`/`id` from a read tool.
- imdbspy_set_status — mark a title seen / not_seen / abandoned (`item_id`).
- imdbspy_update_review — set a weighted rating and/or review. Pass a `scale_type`
  (fun/grit/comfort) plus a `ratings` dict of `<criterion>_rating` values (0-5);
  the 0-10 `user_rating` is computed. For TV, `seasons_seen` records progress.
- imdbspy_refresh_metadata — refresh rating/year/seasons/episodes for all titles
  (network; does not re-download images).

Destructive (requires confirm: true after the user explicitly approves):
- imdbspy_delete_media — permanently remove a title (`item_id`, `confirm`).

Notes:
- `id` is the integer primary key from a read tool; never invent one for an
  update/delete.
- Returned errors carry a stable `code` (validation_error, not_found, conflict,
  permission_denied); surface the message rather than retrying blindly.
- Configuring the rating-scale weights is a UI/API action, not an agent tool.
"""
