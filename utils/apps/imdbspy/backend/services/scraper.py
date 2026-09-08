"""IMDbScraper — GraphQL-based TV/Movie metadata + image extractor.

IMDb's web pages (``m.imdb.com`` / ``www.imdb.com``) now sit behind an AWS WAF
JavaScript challenge that plain HTTP clients cannot pass, so the old HTML /
JSON-LD scrape returns nothing (titles came back as "Unknown Title" / "N/A").

This scraper instead queries IMDb's public GraphQL endpoint
(``api.graphql.imdb.com``), which is *not* behind the challenge and returns all
title metadata — plot, ratings, genres, credits, and cast **with headshot URLs**
— in a single request. The endpoint needs no credentials, but it does 403 any
caller that omits the client headers imdb.com's own web app sends, so
``api_headers`` below carries them. That is both reliable and faster than the
old approach (no per-actor page fetch). Posters and headshots are pulled from the
Amazon image CDN, capped to 512px height, and converted to WebP in the media
cache (``services.media.media_root``).

The scraper performs outbound network I/O and filesystem writes, so services
accept it as an injectable seam — unit tests pass a fake, never this class.
"""

from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Optional

import requests

try:
    from PIL import Image

    HAS_PIL = True
except ImportError:  # pragma: no cover - pillow is a declared dependency
    HAS_PIL = False


GRAPHQL_URL = "https://api.graphql.imdb.com/"

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# One query fetches everything the app stores. Cast is requested with headshot
# URLs inline so no per-actor page fetch is needed.
_TITLE_QUERY = """
query Title($id: ID!, $castLimit: Int!) {
  title(id: $id) {
    id
    titleText { text }
    titleType { id text isSeries isEpisode }
    releaseYear { year endYear }
    plot { plotText { plainText } }
    ratingsSummary { aggregateRating voteCount }
    primaryImage { url }
    runtime { seconds }
    genres { genres { text } }
    episodes {
      episodes(first: 1) { total }
      displayableSeasons(first: 60) { total }
    }
    creators: principalCredits(filter: {categories: ["creator"]}) {
      credits { name { id nameText { text } } }
    }
    directors: principalCredits(filter: {categories: ["director"]}) {
      credits { name { id nameText { text } } }
    }
    writers: principalCredits(filter: {categories: ["writer"]}) {
      credits { name { id nameText { text } } }
    }
    cast: credits(first: $castLimit, filter: {categories: ["cast"]}) {
      edges { node { name { id nameText { text } primaryImage { url } } } }
    }
  }
}
"""


@dataclass
class MediaResult:
    """Data class to hold scraped media information."""

    imdb_id: str
    title: str
    description: str
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    kind: str = "movie"
    genres: list = field(default_factory=list)
    creators: list = field(default_factory=list)
    directors: list = field(default_factory=list)
    writers: list = field(default_factory=list)
    seasons: Optional[int] = None
    episodes: Optional[int] = None
    years: Optional[str] = None
    runtime_minutes: Optional[int] = None
    cast: list = field(default_factory=list)
    total_cast_count: int = 0
    title_image_path: Optional[str] = None
    actor_image_paths: dict = field(default_factory=dict)


class IMDbScraper:
    """GraphQL-backed IMDb scraper for TV shows and movies."""

    def __init__(
        self,
        media_base_path: str | None = None,
        max_actors: int = 5,
        max_workers: int = 5,
        webp_quality: int = 85,
        max_image_height: int = 512,
        timeout: int = 20,
        verbose: bool = False,
    ):
        if media_base_path is None:
            from utils.apps.imdbspy.backend.services.media import media_root

            media_base_path = str(media_root())

        self.media_base_path = os.path.abspath(media_base_path)
        self.actors_path = os.path.join(self.media_base_path, "actors")
        self.tv_movie_path = os.path.join(self.media_base_path, "tv-movie")
        self.max_actors = max_actors
        self.max_workers = max_workers
        self.webp_quality = webp_quality
        self.max_image_height = max_image_height
        self.timeout = timeout
        self.verbose = verbose

        # Image downloads hit the Amazon CDN, which only wants a browser UA.
        self.headers = {
            "User-Agent": _USER_AGENT,
            "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        # The GraphQL endpoint rejects (403) any caller that does not identify
        # itself the way imdb.com's own web client does, so send those headers.
        self.api_headers = {
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://www.imdb.com",
            "Referer": "https://www.imdb.com/",
            "x-imdb-client-name": "imdb-web-next",
            "x-imdb-user-country": "US",
            "x-imdb-user-language": "en-US",
        }

        os.makedirs(self.actors_path, exist_ok=True)
        os.makedirs(self.tv_movie_path, exist_ok=True)

    def _log(self, message: str):
        if self.verbose:
            print(message)

    @staticmethod
    def extract_imdb_id(url: str) -> Optional[str]:
        """Extract the numeric IMDb ID from a full URL or ID string."""
        match = re.search(r"tt(\d+)", url)
        return match.group(1) if match else None

    # --- GraphQL --------------------------------------------------------------

    def _query_title(self, imdb_id: str) -> dict:
        """Run the title query against IMDb's GraphQL API; return the node."""
        payload = {
            "query": _TITLE_QUERY,
            "variables": {"id": f"tt{imdb_id}", "castLimit": self.max_actors},
        }
        response = requests.post(
            GRAPHQL_URL,
            headers=self.api_headers,
            data=json.dumps(payload),
            timeout=self.timeout,
        )
        if response.status_code in (401, 403):
            raise ValueError(
                f"IMDb rejected the metadata request for tt{imdb_id} "
                f"(HTTP {response.status_code}). IMDb may have changed the "
                "client headers its GraphQL API requires."
            )
        response.raise_for_status()
        body = response.json()
        # Partial errors can accompany usable data; only fail when there is no data.
        node = (body.get("data") or {}).get("title")
        if node is None:
            errors = body.get("errors") or [{"message": "no data"}]
            raise ValueError(f"IMDb GraphQL returned no title: {errors[0].get('message')}")
        return node

    @staticmethod
    def _people(groups: Any) -> list[dict]:
        """Flatten principalCredits groups into ``[{name, id}]`` (id = digits)."""
        out: list[dict] = []
        seen: set[str] = set()
        for group in groups or []:
            for credit in group.get("credits", []) or []:
                name_obj = credit.get("name") or {}
                name = (name_obj.get("nameText") or {}).get("text")
                if not name:
                    continue
                nm_id = (name_obj.get("id") or "").replace("nm", "") or None
                key = nm_id or name
                if key in seen:
                    continue
                seen.add(key)
                out.append({"name": name, "id": nm_id})
        return out

    @staticmethod
    def _format_years(year: Any, end_year: Any, is_series: bool) -> Optional[str]:
        if not year:
            return None
        if is_series:
            return f"{year}-{end_year}" if end_year else f"{year}-"
        return str(year)

    # --- images ---------------------------------------------------------------

    def _cdn_resize(self, url: str) -> str:
        """Ask the Amazon image CDN for a height-capped variant to save bandwidth.

        IMDb/Amazon media URLs accept a sizing op embedded before the extension
        (``UY<height>`` = scale to that height). The local PIL cap below still
        enforces the limit if the CDN ignores the hint.
        """
        if "._V1_" in url:
            base = url.split("._V1_")[0]
            return f"{base}._V1_QL90_UY{self.max_image_height}_.jpg"
        return url

    def _download_image(self, url: str, save_path: str) -> Optional[str]:
        """Download an image, cap its height, convert to WebP.

        Returns the media-relative path (e.g. ``tv-movie/123.webp``) or ``None``.
        """
        try:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            response = requests.get(
                self._cdn_resize(url), headers=self.headers, timeout=self.timeout
            )
            response.raise_for_status()
            image_data = response.content

            if HAS_PIL:
                img = Image.open(BytesIO(image_data))

                if img.height > self.max_image_height:
                    ratio = self.max_image_height / img.height
                    new_size = (max(1, round(img.width * ratio)), self.max_image_height)
                    img = img.resize(new_size, Image.LANCZOS)

                if img.mode in ("RGBA", "LA", "P"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(
                        img, mask=img.split()[-1] if img.mode == "RGBA" else None
                    )
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                webp_path = os.path.splitext(save_path)[0] + ".webp"
                img.save(webp_path, "WEBP", quality=self.webp_quality, method=6)
                final_path = webp_path
            else:
                with open(save_path, "wb") as handle:
                    handle.write(image_data)
                final_path = save_path

            rel_path = os.path.relpath(final_path, self.media_base_path)
            return rel_path.replace(os.path.sep, "/")
        except Exception as exc:  # image failures are non-fatal
            self._log(f"  image download failed ({url}): {exc}")
            return None

    # --- public API -----------------------------------------------------------

    def run(self, url_or_id: str) -> MediaResult:
        """Scrape full information (with images) for a movie or TV show."""
        imdb_id = self.extract_imdb_id(url_or_id)
        if not imdb_id:
            imdb_id = url_or_id if url_or_id.isdigit() else None
        if not imdb_id:
            raise ValueError(f"Could not extract IMDb ID from: {url_or_id}")

        self._log(f"Fetching data for IMDb ID: tt{imdb_id}...")
        node = self._query_title(imdb_id)

        title_type = node.get("titleType") or {}
        is_series = bool(title_type.get("isSeries"))
        kind = (title_type.get("id") or ("tvseries" if is_series else "movie")).lower()

        result = MediaResult(
            imdb_id=imdb_id,
            title=(node.get("titleText") or {}).get("text") or "Unknown Title",
            description=((node.get("plot") or {}).get("plotText") or {}).get("plainText")
            or "",
            kind=kind,
        )

        result.genres = [
            g.get("text")
            for g in ((node.get("genres") or {}).get("genres") or [])
            if g.get("text")
        ]

        ratings = node.get("ratingsSummary") or {}
        result.rating = ratings.get("aggregateRating")
        result.rating_count = ratings.get("voteCount")

        release_year = node.get("releaseYear") or {}
        result.years = self._format_years(
            release_year.get("year"), release_year.get("endYear"), is_series
        )

        runtime = node.get("runtime") or {}
        if runtime.get("seconds"):
            result.runtime_minutes = int(runtime["seconds"] // 60)

        result.creators = self._people(node.get("creators"))
        result.directors = self._people(node.get("directors"))
        result.writers = self._people(node.get("writers"))

        if is_series:
            episodes = node.get("episodes") or {}
            result.seasons = ((episodes.get("displayableSeasons") or {}).get("total")) or None
            result.episodes = ((episodes.get("episodes") or {}).get("total")) or None

        # Cast (names + headshot URLs come back inline).
        cast_entries: list[dict] = []
        for edge in (node.get("cast") or {}).get("edges") or []:
            name_obj = (edge.get("node") or {}).get("name") or {}
            name = (name_obj.get("nameText") or {}).get("text")
            if not name:
                continue
            nm_id = (name_obj.get("id") or "").replace("nm", "") or None
            image_url = (name_obj.get("primaryImage") or {}).get("url")
            cast_entries.append({"name": name, "id": nm_id, "image_url": image_url})

        result.total_cast_count = len(cast_entries)
        result.cast = [{"name": c["name"], "id": c["id"]} for c in cast_entries]

        # Download poster + headshots in parallel (all URLs already known).
        jobs: list[tuple[str, str, str]] = []  # (key, url, save_path)
        poster_url = (node.get("primaryImage") or {}).get("url")
        if poster_url:
            jobs.append(
                ("__poster__", poster_url, os.path.join(self.tv_movie_path, f"{imdb_id}.webp"))
            )
        for entry in cast_entries:
            if entry["image_url"] and entry["id"]:
                jobs.append(
                    (
                        entry["name"],
                        entry["image_url"],
                        os.path.join(self.actors_path, f"{entry['id']}.webp"),
                    )
                )

        if jobs:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {
                    executor.submit(self._download_image, url, path): key
                    for key, url, path in jobs
                }
                for future in as_completed(futures):
                    key = futures[future]
                    rel_path = future.result()
                    if not rel_path:
                        continue
                    if key == "__poster__":
                        result.title_image_path = rel_path
                    else:
                        result.actor_image_paths[key] = rel_path

        return result

    def refresh_metadata(self, imdb_id: str) -> dict:
        """Fetch fresh metadata for an existing item WITHOUT downloading images."""
        node = self._query_title(imdb_id)

        title_type = node.get("titleType") or {}
        is_series = bool(title_type.get("isSeries"))

        result: dict = {}
        ratings = node.get("ratingsSummary") or {}
        if ratings.get("aggregateRating") is not None:
            result["rating"] = ratings.get("aggregateRating")
            result["rating_count"] = ratings.get("voteCount")

        release_year = node.get("releaseYear") or {}
        result["years"] = self._format_years(
            release_year.get("year"), release_year.get("endYear"), is_series
        )

        if is_series:
            episodes = node.get("episodes") or {}
            result["seasons"] = ((episodes.get("displayableSeasons") or {}).get("total")) or None
            result["episodes"] = ((episodes.get("episodes") or {}).get("total")) or None

        return result
