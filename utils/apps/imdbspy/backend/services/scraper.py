"""IMDbScraper - TV Show/Movie information extractor.

Ported unchanged (behaviorally) from the standalone app's ``utils/cinemagoer.py``.
Uses selective Cinemagoer loading, mobile-site JSON-LD/HTML parsing, parallel
actor-image downloads, and WebP conversion. Images are written into the IMDbSpy
media cache (``services/media.media_root``).

The scraper performs outbound network I/O (``m.imdb.com`` + the IMDb image CDN)
and filesystem writes, so services accept it as an injectable seam — unit tests
pass a fake, never this class.
"""

from __future__ import annotations

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from io import BytesIO
from typing import Optional

import requests
from imdb import Cinemagoer

try:
    from PIL import Image

    HAS_PIL = True
except ImportError:  # pragma: no cover - pillow is a declared dependency
    HAS_PIL = False


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
    """Class-based IMDb scraper for TV shows and movies."""

    def __init__(
        self,
        media_base_path: str | None = None,
        max_actors: int = 5,
        max_workers: int = 5,
        webp_quality: int = 85,
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
        self.verbose = verbose

        # Cinemagoer is only a metadata *fallback* (the primary path is the
        # mobile-site JSON-LD/HTML scrape via requests). Its construction can
        # fail depending on the installed access system, so tolerate that and
        # fall back to the requests path alone. Mute the library's own logger
        # during construction so a failed access system does not spam CRITICAL.
        _imdb_logger = logging.getLogger("imdbpy")
        _was_disabled = _imdb_logger.disabled
        _imdb_logger.disabled = True
        try:
            self._ia = Cinemagoer()
        except Exception:
            self._ia = None
        finally:
            _imdb_logger.disabled = _was_disabled

        self.mobile_headers = {
            "User-Agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
                "Mobile/15E148 Safari/604.1"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
                "image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
            ),
            "Accept-Language": "en-US,en;q=0.9",
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

    def _get_image_extension(self, url: str) -> str:
        if ".png" in url.lower():
            return ".png"
        elif ".webp" in url.lower():
            return ".webp"
        return ".jpg"

    def _extract_person_info(self, person_data: dict) -> dict:
        name = person_data.get("name", "Unknown")
        url = person_data.get("url", "")
        nm_id = None
        match = re.search(r"nm(\d+)", url)
        if match:
            nm_id = match.group(1)
        return {"name": name, "id": nm_id}

    def _download_and_convert_to_webp(
        self, url: str, save_path: str, resize_max: Optional[int] = None
    ) -> tuple[bool, str, Optional[str]]:
        """Download an image and convert to WebP. Returns (success, msg, path)."""
        try:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)

            response = requests.get(url, headers=self.mobile_headers, timeout=15)
            response.raise_for_status()
            image_data = response.content

            if HAS_PIL:
                img = Image.open(BytesIO(image_data))

                if resize_max:
                    img.thumbnail((resize_max, resize_max))

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

                webp_path = save_path.rsplit(".", 1)[0] + ".webp"
                img.save(webp_path, "WEBP", quality=self.webp_quality, method=6)
                return True, f"ok {os.path.basename(webp_path)}", webp_path
            else:
                with open(save_path, "wb") as f:
                    f.write(image_data)
                return True, f"ok {os.path.basename(save_path)}", save_path

        except Exception as e:
            return False, f"failed: {e}", None

    def _fetch_imdb_page_data(self, imdb_id: str) -> tuple[dict, list, str]:
        """Fetch data from IMDb page. Returns (json_ld_data, cast_list, html)."""
        url = f"https://m.imdb.com/title/tt{imdb_id}/"

        json_data: dict = {}
        cast_list: list = []
        html = ""

        try:
            response = requests.get(url, headers=self.mobile_headers, timeout=15)
            response.raise_for_status()
            html = response.text

            json_ld_match = re.search(
                r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL
            )
            if json_ld_match:
                json_data = json.loads(json_ld_match.group(1))

            cast_matches = re.findall(
                r'data-testid="title-cast-item__actor"[^>]*href="/name/(nm\d+)[^"]*"[^>]*>([^<]+)</a>',
                html,
            )

            seen_ids: set = set()
            for nm_id, actor_name in cast_matches:
                if nm_id not in seen_ids:
                    seen_ids.add(nm_id)
                    cast_list.append(
                        {
                            "name": actor_name.strip(),
                            "id": nm_id.replace("nm", ""),
                            "full_id": nm_id,
                        }
                    )

        except Exception as e:
            self._log(f"  Warning: Could not fetch page data: {e}")

        return json_data, cast_list, html

    def _get_person_headshot(self, person_id: str) -> tuple[str, Optional[str]]:
        try:
            url = f"https://m.imdb.com/name/nm{person_id}/"
            response = requests.get(url, headers=self.mobile_headers, timeout=10)
            response.raise_for_status()
            html = response.text

            json_ld_match = re.search(
                r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL
            )
            if json_ld_match:
                json_data = json.loads(json_ld_match.group(1))
                if "image" in json_data:
                    return person_id, json_data["image"]
        except Exception:
            pass

        return person_id, None

    def _download_actor_image(
        self, actor_id: str, actor_name: str
    ) -> tuple[str, bool, str, Optional[str]]:
        headshot_url = self._get_person_headshot(actor_id)[1]

        if headshot_url:
            save_path = os.path.join(self.actors_path, f"{actor_id}.jpg")
            success, msg, final_path = self._download_and_convert_to_webp(
                headshot_url, save_path, resize_max=256
            )
            return actor_name, success, msg, final_path
        else:
            return actor_name, False, "No headshot available", None

    def run(self, url_or_id: str) -> MediaResult:
        """Scrape information for a movie or TV show."""
        imdb_id = self.extract_imdb_id(url_or_id)
        if not imdb_id:
            imdb_id = url_or_id if url_or_id.isdigit() else None

        if not imdb_id:
            raise ValueError(f"Could not extract IMDb ID from: {url_or_id}")

        self._log(f"Fetching data for IMDb ID: tt{imdb_id}...")

        page_data, cast_list, raw_html = self._fetch_imdb_page_data(imdb_id)

        show: dict = {}
        if self._ia is not None:
            try:
                show_obj = self._ia.get_movie(imdb_id, info=["main"])
                if show_obj:
                    show = show_obj.data
            except Exception as e:
                self._log(f"  Warning: Cinemagoer fallback failed: {e}")

        result = MediaResult(imdb_id=imdb_id, title="Unknown", description="")

        # 1) Title
        result.title = page_data.get("name") or show.get("title", "Unknown Title")

        # 2) Description
        result.description = page_data.get("description", "")
        if not result.description:
            plot_list = show.get("plot", [])
            if plot_list:
                result.description = (
                    plot_list[0] if isinstance(plot_list, list) else plot_list
                )
                if "::" in result.description:
                    result.description = result.description.split("::")[0].strip()

        # 3) Genres
        genres = page_data.get("genre", [])
        if isinstance(genres, str):
            genres = [genres]
        result.genres = genres

        # 4) Rating
        rating_data = page_data.get("aggregateRating", {})
        if rating_data:
            result.rating = rating_data.get("ratingValue")
            result.rating_count = rating_data.get("ratingCount")

        # 5) Creators / Directors / Writers
        creator_data = page_data.get("creator", [])
        director_data = page_data.get("director", [])
        if isinstance(creator_data, dict):
            creator_data = [creator_data]
        if isinstance(director_data, dict):
            director_data = [director_data]

        # 6) Kind + Year
        kind = show.get("kind", page_data.get("@type", "Movie")).lower()
        result.kind = kind

        date_published = page_data.get("datePublished", "")
        if date_published and len(date_published) >= 4:
            result.years = date_published[:4]

        if not result.years or result.years == "N/A" or len(getattr(result, "years", "")) <= 4:
            range_match = re.search(
                r"((?:19|20)\d{2}[–-](?:19|20)\d{2}|(?:19|20)\d{2}[–-]\s)",
                raw_html,
            )
            if range_match:
                result.years = range_match.group(1).strip()

            if not result.years or result.years == "N/A":
                if "tv" in kind or "series" in kind:
                    years_match = re.search(r"\(TV Series ([\d–-]+)\)", raw_html)
                    if years_match:
                        result.years = years_match.group(1)
                else:
                    years_match = re.search(r"\((\d{4})\)", raw_html)
                    if years_match:
                        result.years = years_match.group(1)

        if not result.years or result.years == "N/A":
            result.years = show.get("series years") or str(show.get("year", "N/A"))

        if "tv" in kind or "series" in kind:
            result.creators = [
                self._extract_person_info(c)
                for c in creator_data
                if c.get("@type") == "Person"
            ]

            result.seasons = show.get("number of seasons")
            result.episodes = page_data.get("numberOfEpisodes") or show.get(
                "number of episodes"
            )

            if not result.seasons:
                seasons_match = re.search(r"(\d+)\s+Seasons?", raw_html, re.IGNORECASE)
                if seasons_match:
                    result.seasons = int(seasons_match.group(1))

            if not result.episodes:
                episodes_match = re.search(
                    r"(\d+)\s+Episodes?", raw_html, re.IGNORECASE
                )
                if episodes_match:
                    result.episodes = int(episodes_match.group(1))
        else:
            result.directors = [
                self._extract_person_info(d)
                for d in director_data
                if d.get("@type") == "Person"
            ]
            result.writers = [
                self._extract_person_info(c)
                for c in creator_data
                if c.get("@type") == "Person"
            ]

            runtimes = show.get("runtimes", [])
            duration = page_data.get("duration", "")
            if runtimes:
                result.runtime_minutes = int(runtimes[0])
            elif duration:
                mins_match = re.search(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration)
                if mins_match:
                    hours = int(mins_match.group(1) or 0)
                    mins = int(mins_match.group(2) or 0)
                    result.runtime_minutes = hours * 60 + mins

        # 7) Cast
        result.total_cast_count = len(cast_list)
        actors_to_fetch = cast_list[: self.max_actors]
        result.cast = [{"name": a["name"], "id": a["id"]} for a in actors_to_fetch]

        # 8) Title image
        cover_url = page_data.get("image") or show.get("cover url")
        if cover_url:
            save_path = os.path.join(self.tv_movie_path, f"{imdb_id}.jpg")
            success, msg, final_path = self._download_and_convert_to_webp(
                cover_url, save_path
            )
            if final_path:
                rel_path = os.path.relpath(final_path, self.media_base_path)
                result.title_image_path = rel_path.replace(os.path.sep, "/")

        # 9) Actor images (parallel)
        if actors_to_fetch:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {
                    executor.submit(
                        self._download_actor_image, actor["id"], actor["name"]
                    ): actor["name"]
                    for actor in actors_to_fetch
                }

                for future in as_completed(futures):
                    actor_name, success, msg, path = future.result()
                    if path:
                        rel_path = os.path.relpath(path, self.media_base_path)
                        result.actor_image_paths[actor_name] = rel_path.replace(
                            os.path.sep, "/"
                        )

        return result

    def refresh_metadata(self, imdb_id: str) -> dict:
        """Fetch fresh metadata for an existing item WITHOUT downloading images."""
        page_data, cast_list, raw_html = self._fetch_imdb_page_data(imdb_id)

        show: dict = {}
        if self._ia is not None:
            try:
                show_obj = self._ia.get_movie(imdb_id, info=["main"])
                if show_obj:
                    show = show_obj.data
            except Exception as e:
                self._log(f"  Warning: Cinemagoer fallback failed: {e}")

        result: dict = {}

        rating_data = page_data.get("aggregateRating", {})
        if rating_data:
            result["rating"] = rating_data.get("ratingValue")
            result["rating_count"] = rating_data.get("ratingCount")

        kind = show.get("kind", page_data.get("@type", "Movie")).lower()

        years = None
        date_published = page_data.get("datePublished", "")
        if date_published and len(date_published) >= 4:
            years = date_published[:4]

        if not years or years == "N/A":
            range_match = re.search(
                r"((?:19|20)\d{2}[–-](?:19|20)\d{2}|(?:19|20)\d{2}[–-]\s)",
                raw_html,
            )
            if range_match:
                years = range_match.group(1).strip()

        if not years or years == "N/A":
            if "tv" in kind or "series" in kind:
                years_match = re.search(r"\(TV Series ([\d–-]+)\)", raw_html)
                if years_match:
                    years = years_match.group(1)
            else:
                years_match = re.search(r"\((\d{4})\)", raw_html)
                if years_match:
                    years = years_match.group(1)

        if not years or years == "N/A":
            years = show.get("series years") or str(show.get("year", "N/A"))

        result["years"] = years

        if "tv" in kind or "series" in kind:
            result["seasons"] = show.get("number of seasons")
            result["episodes"] = page_data.get("numberOfEpisodes") or show.get(
                "number of episodes"
            )

            if not result["seasons"]:
                seasons_match = re.search(r"(\d+)\s+Seasons?", raw_html, re.IGNORECASE)
                if seasons_match:
                    result["seasons"] = int(seasons_match.group(1))

            if not result["episodes"]:
                episodes_match = re.search(
                    r"(\d+)\s+Episodes?", raw_html, re.IGNORECASE
                )
                if episodes_match:
                    result["episodes"] = int(episodes_match.group(1))

        return result
