"""One sandbox for every app at once.

A mixed scenario ("log my run, then mark the movie as seen") needs the exercise
database *and* the IMDbSpy database live in the same run, with the mailbox,
calendar and artifact stores pointed at throwaway files, and every network seam
(IMAP/SMTP, Strava, the IMDb scraper, SearXNG) replaced by a fake that records
what it was asked to do. The per-app fixtures in the root ``conftest.py``
already do the database part one app at a time; :func:`build_sandbox` composes
them, adds the file stores and the fakes, and seeds a small, deterministic
dataset every scenario can rely on — ids prefixed ``scn_`` so they never
collide with a maintainer's own rows on a machine that has real data.

The sandbox is built by the ``sandbox`` fixture in ``conftest.py`` and handed
to each scenario's ``setup`` hook and dynamic-argument steps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image

# --- fakes for the network seams ------------------------------------------------


class FakeMail:
    """Stands in for both ``mailbox.backend.services.messages`` and ``mailops``.

    Holds a folder tree and a few messages per folder, and implements every
    service function the mailbox tools call, recording each call so a scenario
    can assert what the tool asked the provider to do.
    """

    def __init__(self, account_id: str):
        from utils.apps.mailbox.shared.schemas import MessageDTO

        self.account_id = account_id
        self.calls: List[Dict[str, Any]] = []
        self.folders: List[str] = ["INBOX", "Sent", "Trash", "Archive"]
        self.messages: Dict[str, List[MessageDTO]] = {
            "INBOX": [
                MessageDTO(
                    uid="101", provider="gmail", account="scenario@example.com",
                    subject="Invoice #4411 due Friday", from_addr="billing@vendor.example",
                    to_addr="scenario@example.com", date="Mon, 07 Sep 2026 09:12:00 +0000",
                    snippet="Please find attached invoice 4411.", message_id="<inv-4411@vendor>",
                    flags=[],
                ),
                MessageDTO(
                    uid="102", provider="gmail", account="scenario@example.com",
                    subject="Team lunch on Thursday?", from_addr="sam@example.com",
                    to_addr="scenario@example.com", date="Mon, 07 Sep 2026 11:40:00 +0000",
                    snippet="Thinking tacos. In?", message_id="<lunch-1@example>",
                    flags=["\\Seen"],
                ),
                MessageDTO(
                    uid="103", provider="gmail", account="scenario@example.com",
                    subject="Your weekly workout summary", from_addr="noreply@strava.example",
                    to_addr="scenario@example.com", date="Sun, 06 Sep 2026 18:00:00 +0000",
                    snippet="You ran 12 km this week.", message_id="<strava-wk@example>",
                    flags=[],
                ),
            ],
            "Sent": [], "Trash": [], "Archive": [],
        }

    def _record(self, op: str, **kw) -> None:
        self.calls.append({"op": op, **kw})

    def _check_account(self, account_id: str) -> None:
        from utils.apps.mailbox.shared.errors import NotFoundError

        if account_id != self.account_id:
            raise NotFoundError(f"Account '{account_id}' not found")

    # messages service --------------------------------------------------------
    def list_folders(self, account_id: str, **kw) -> Dict[str, Any]:
        self._check_account(account_id)
        self._record("list_folders", account=account_id)
        return {
            "tree": [{"name": f, "path": f, "children": []} for f in self.folders],
            "flat": list(self.folders),
            "count": len(self.folders),
        }

    def list_messages(self, account_id: str, *, folder: str = "INBOX", limit=25, **kw):
        from utils.apps.mailbox.shared.errors import NotFoundError

        self._check_account(account_id)
        self._record("list_messages", account=account_id, folder=folder, limit=limit)
        if folder not in self.messages:
            raise NotFoundError(f"Folder '{folder}' not found")
        items = self.messages[folder]
        return items[:limit] if limit else list(items)

    # mailops service ---------------------------------------------------------
    def _take(self, source: str, uids: List[str]):
        from utils.apps.mailbox.shared.errors import NotFoundError

        taken = []
        for uid in uids:
            match = next((m for m in self.messages.get(source, []) if m.uid == uid), None)
            if match is None:
                raise NotFoundError(f"uid {uid} not in {source}")
            self.messages[source].remove(match)
            taken.append(match)
        return taken

    def organize(self, account_id, *, uid, dest, source="INBOX", create_if_missing=True):
        self._check_account(account_id)
        self._record("organize", uid=uid, dest=dest, source=source)
        if dest not in self.folders:
            if not create_if_missing:
                from utils.apps.mailbox.shared.errors import NotFoundError

                raise NotFoundError(f"Folder '{dest}' not found")
            self.folders.append(dest)
            self.messages[dest] = []
        self.messages[dest].extend(self._take(source, [uid]))
        return {"uid": uid, "moved_to": dest, "method": "MOVE", "created_folder": False}

    def move(self, account_id, *, uids, dest, source="INBOX", create_if_missing=True):
        self._check_account(account_id)
        self._record("move", uids=list(uids), dest=dest, source=source)
        if dest not in self.folders:
            self.folders.append(dest)
            self.messages[dest] = []
        self.messages[dest].extend(self._take(source, list(uids)))
        return {"uids": list(uids), "moved_to": dest, "method": "MOVE"}

    def mark(self, account_id, *, uids, read=None, starred=None, source="INBOX"):
        self._check_account(account_id)
        self._record("mark", uids=list(uids), read=read, starred=starred, source=source)
        added, removed = [], []
        for m in self.messages.get(source, []):
            if m.uid not in uids:
                continue
            for flag, value in (("\\Seen", read), ("\\Flagged", starred)):
                if value is True and flag not in m.flags:
                    m.flags.append(flag)
                    added.append(flag)
                elif value is False and flag in m.flags:
                    m.flags.remove(flag)
                    removed.append(flag)
        return {"uids": list(uids), "added": sorted(set(added)), "removed": sorted(set(removed))}

    def delete(self, account_id, *, uids, source="INBOX", permanent=False):
        self._check_account(account_id)
        self._record("delete", uids=list(uids), source=source, permanent=permanent)
        taken = self._take(source, list(uids))
        if not permanent:
            self.messages["Trash"].extend(taken)
        return {"uids": list(uids), "deleted": True, "permanent": permanent,
                "moved_to": None if permanent else "Trash", "method": "MOVE"}

    def create_folder(self, account_id, *, name):
        self._check_account(account_id)
        self._record("create_folder", name=name)
        created = name not in self.folders
        if created:
            self.folders.append(name)
            self.messages[name] = []
        return {"folder": name, "created": created}

    def send(self, account_id, *, to, subject, body, cc=None, html=None):
        self._check_account(account_id)
        self._record("send", to=list(to), subject=subject, body=body, cc=cc)
        return {"sent": True, "accepted": list(to), "refused": []}

    def reply(self, account_id, *, uid, body, html=None, reply_all=False, source="INBOX"):
        from utils.apps.mailbox.shared.errors import NotFoundError

        self._check_account(account_id)
        self._record("reply", uid=uid, body=body, reply_all=reply_all, source=source)
        original = next((m for m in self.messages.get(source, []) if m.uid == uid), None)
        if original is None:
            raise NotFoundError(f"uid {uid} not in {source}")
        return {"sent": True, "in_reply_to": original.message_id,
                "to": [original.from_addr], "reply_all": reply_all}


class FakeStrava:
    """The Strava sync seam: configured (imports) or not (permission_denied)."""

    def __init__(self, configured: bool = True):
        self.configured = configured
        self.calls: List[str] = []

    def sync_strava(self, period: str = "week") -> Dict[str, int]:
        from utils.apps.exercise.shared.errors import PermissionDeniedError, ValidationError

        self.calls.append(period)
        if period not in ("week", "all"):
            raise ValidationError("period must be 'week' or 'all'")
        if not self.configured:
            raise PermissionDeniedError("Strava credentials are not configured")
        return {"fetched": 3, "imported": 2, "skipped": 1}


class FakeResearch:
    """Replaces ``run_research`` so ``search_web`` returns canned sources."""

    def __init__(self):
        self.queries: List[str] = []

    def __call__(self, query: str, *, citation_offset: int = 0, **kw):
        from utils.shared.search.research import ResearchResult, ResearchSource

        self.queries.append(query)
        sources = [
            ResearchSource(index=citation_offset + 1, title="Django 5.2 release notes",
                           url="https://docs.djangoproject.com/en/5.2/releases/5.2/",
                           snippet="Django 5.2 is the current LTS.",
                           excerpt="Django 5.2 is designated as a long-term support release."),
            ResearchSource(index=citation_offset + 2, title="Django download",
                           url="https://www.djangoproject.com/download/",
                           snippet="Supported versions.", excerpt="Latest LTS: 5.2."),
        ]
        return ResearchResult(query=query, rounds_used=1, sources=sources)


# --- the sandbox ----------------------------------------------------------------


@dataclass
class Sandbox:
    root: Path
    today: str
    tomorrow: str
    #: Ids and names the seed created, keyed by app then by role.
    seeded: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    mail: Optional[FakeMail] = None
    strava: Optional[FakeStrava] = None
    research: Optional[FakeResearch] = None
    scraper: Any = None

    def seed(self, app: str, key: str) -> Any:
        return self.seeded[app][key]


def _png_bytes() -> bytes:
    from io import BytesIO

    buf = BytesIO()
    Image.new("RGB", (24, 24), (255, 160, 20)).save(buf, format="PNG")
    return buf.getvalue()


def seed_exercise(sb: Sandbox) -> None:
    from utils.apps.exercise.backend.services import equipment, history, routines, workouts
    from utils.apps.exercise.shared.schemas import EquipmentDTO, HistoryDTO, RoutineDTO, WorkoutDTO

    workout = WorkoutDTO.from_dict({
        "id": "scn_push", "name": "Scenario Push Day", "color": "red",
        "exercises": [
            {"id": "scn_bench", "name": "Bench Press", "sets": 3, "reps": 8, "rest": 90, "weight": 135},
            {"id": "scn_ohp", "name": "Overhead Press", "sets": 3, "reps": 10, "rest": 60, "weight": 65},
        ],
    })
    workouts.save_workout(workout)
    routines.save_routine(RoutineDTO.from_dict({
        "id": "scn_routine", "name": "Scenario Weekly", "workouts": {"0": ["scn_push"], "3": ["scn_push"]},
    }))
    equipment.add_equipment(EquipmentDTO.from_dict({
        "id": "scn_dumbbells", "name": "Scenario Dumbbells", "type": "dumbbell",
        "min_weight": 5, "max_weight": 50, "unit": "lbs",
    }))
    history.add_log(HistoryDTO.from_dict({
        "id": "scn_hist_1", "workout_id": "scn_push", "date": "2026-09-01",
        "duration": 3600, "volume": 5400,
        "exercises": [{"id": "scn_bench", "name": "Bench Press", "sets": [{"reps": 8, "weight": 135}] * 3}],
    }))
    history.add_log(HistoryDTO.from_dict({
        "id": "scn_hist_2", "workout_id": "run", "date": "2026-09-03",
        "duration": 1800, "volume": 5.0, "exercises": [],
    }))
    sb.seeded["exercise"] = {
        "workout_id": "scn_push", "routine_id": "scn_routine",
        "equipment_id": "scn_dumbbells", "history_ids": ["scn_hist_1", "scn_hist_2"],
    }


def seed_timekeeper(sb: Sandbox) -> None:
    from utils.apps.timekeeper.backend.services import categories, logs

    existing = categories.get_categories()
    taxonomy = existing or []
    if not any(c["id"] == "scn_work" for c in taxonomy):
        taxonomy = taxonomy + [
            {"id": "scn_work", "name": "Scenario Work", "colorId": "blue",
             "subcategories": [{"id": "scn_code", "name": "Coding", "l": 50},
                               {"id": "scn_review", "name": "Review", "l": 70}]},
            {"id": "scn_rest", "name": "Scenario Rest", "colorId": "green",
             "subcategories": [{"id": "scn_walk", "name": "Walk", "l": 50}]},
        ]
        categories.save_categories(taxonomy)
    # 08:00–09:00 coding, 09:00–09:30 walk on a fixed day.
    intervals = [{"index": i, "category_id": "scn_work", "subcategory_id": "scn_code"} for i in range(96, 108)]
    intervals += [{"index": i, "category_id": "scn_rest", "subcategory_id": "scn_walk"} for i in range(108, 114)]
    saved = logs.save_day("2026-09-01", intervals)
    sb.seeded["timekeeper"] = {
        "date": "2026-09-01", "category_id": "scn_work", "subcategory_id": "scn_code",
        "rest_category_id": "scn_rest", "rest_subcategory_id": "scn_walk",
        "log_ids": [dto.id for dto in saved],
    }


def seed_projectmanager(sb: Sandbox) -> None:
    from utils.apps.projectmanager.backend.services import goals, projects
    from utils.apps.projectmanager.shared.schemas import NewGoalDTO, NewProjectDTO

    project = projects.create_project(NewProjectDTO.from_dict({
        "title": "Scenario Garden Build", "category_name": "Scenario Home",
        "category_color": "green", "description": "Raised beds and irrigation.",
        "deadline": f"{sb.today}T00:00:00",
    }))
    created = goals.create_goals(project.id, [
        NewGoalDTO.from_dict({"title": "Order lumber", "deadline": f"{sb.tomorrow}T00:00:00"}),
        NewGoalDTO.from_dict({"title": "Lay out beds"}),
    ])
    sb.seeded["projectmanager"] = {
        "project_id": project.id, "project_title": project.title,
        "goal_ids": [g.id for g in created],
    }


def seed_imdbspy(sb: Sandbox) -> None:
    from utils.apps.imdbspy.backend.models import MediaItem

    movie = MediaItem.objects.create(
        imdb_id="0111161", title="The Shawshank Redemption", kind="movie", status="not_seen",
        genres=["Drama"], rating=9.3, years="1994", runtime_minutes=142,
    )
    show = MediaItem.objects.create(
        imdb_id="8910922", title="Severance", kind="tv series", status="seen",
        genres=["Drama", "Mystery"], rating=8.7, years="2022–", seasons=2, seasons_seen=1,
    )
    sb.seeded["imdbspy"] = {
        "movie_id": movie.id, "movie_imdb_id": movie.imdb_id, "movie_title": movie.title,
        "show_id": show.id, "show_title": show.title,
        "new_imdb_id": "0068646", "new_title": "The Godfather",
    }


def seed_recipes(sb: Sandbox) -> None:
    from utils.apps.recipes.backend.services import ingredients, recipes

    summaries = recipes.list_all()
    catalog = ingredients.list_all()
    first = summaries[0] if summaries else None
    sb.seeded["recipes"] = {
        "recipe_id": first.id if first else None,
        "recipe_title": first.title if first else None,
        "recipe_count": len(summaries),
        "ingredient_names": [row.name for row in catalog[:5]],
    }


def seed_calendar(sb: Sandbox) -> None:
    from utils.apps.calendar.backend.services import calendar, schedules

    names = schedules.list_schedules()
    dentist = calendar.add_direct_event({
        "date": sb.tomorrow, "title": "Scenario Dentist", "type": "health",
        "start": "10:00", "end": "11:00", "sub": "",
    })
    standup = calendar.add_direct_event({
        "date": sb.tomorrow, "title": "Scenario Standup", "type": "work",
        "start": "14:00", "end": "14:30", "sub": "",
    })
    sb.seeded["calendar"] = {
        "schedules": names, "dentist_index": dentist, "standup_index": standup,
        "dentist_title": "Scenario Dentist",
    }


def seed_artifacts(sb: Sandbox) -> None:
    from utils.apps.media_viewer.backend.services.artifact_store import ArtifactStore

    store = ArtifactStore()
    note = store.save(
        filename="scenario-notes.md",
        data=b"# Scenario notes\n\nRemember to water the tomatoes on Thursday.\n",
        mime_type="text/markdown", source="manual",
    )
    image = store.save(filename="scenario-swatch.png", data=_png_bytes(), mime_type="image/png",
                       source="manual")
    sb.seeded["artifacts"] = {
        "note_id": note.id, "note_filename": note.filename,
        "image_id": image.id, "image_filename": image.filename,
    }


def seed_mailbox(sb: Sandbox) -> None:
    from utils.apps.mailbox.backend.services import config_store

    account = config_store.save_account({
        "provider": "gmail", "display_name": "Scenario Work", "email": "scenario@example.com",
    })
    sb.mail = FakeMail(account.id)
    sb.seeded["mailbox"] = {
        "account_id": account.id, "email": account.email,
        "invoice_uid": "101", "lunch_uid": "102", "strava_uid": "103",
    }


def build_sandbox(root: Path, monkeypatch) -> Sandbox:
    """Wire the file stores and the fakes, then seed every app.

    The database bindings are the caller's job (the root conftest fixtures);
    this function assumes every app connection already points at a throwaway DB.
    """
    from utils.agents.tools import registry as registry_module
    from utils.agents.tools import web_search as web_search_module
    from utils.apps.exercise.agent import tools as exercise_tools
    from utils.apps.imdbspy.backend.services import media_items
    from utils.apps.mailbox.agent import tools as mailbox_tools
    from utils.tests.utils.apps.imdbspy.fakes import FakeScraper, make_result

    today = date.today()
    sb = Sandbox(root=root, today=today.isoformat(),
                 tomorrow=(today + timedelta(days=1)).isoformat())

    artifacts_root = root / "artifacts"
    monkeypatch.setenv("MANGO_ARTIFACTS_ROOT", str(artifacts_root))
    monkeypatch.setattr(registry_module, "ARTIFACTS_DIR", str(artifacts_root))
    monkeypatch.setenv("MANGO_CALENDAR_DATA_DIR", str(root / "calendar"))
    monkeypatch.setenv("MANGO_IMDBSPY_MEDIA_DIR", str(root / "imdb-media"))
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(root / "mailbox" / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(root / "mailbox" / "secrets.json"))
    monkeypatch.setenv("MANGO_MAILBOX_CACHE", str(root / "mailbox" / "cache"))

    sb.strava = FakeStrava(configured=True)
    monkeypatch.setattr(exercise_tools, "_strava", sb.strava)

    sb.research = FakeResearch()
    monkeypatch.setattr(web_search_module, "run_research", sb.research)

    sb.scraper = FakeScraper(results={
        "tt0068646": make_result(imdb_id="0068646", title="The Godfather", rating=9.2, years="1972"),
        "0068646": make_result(imdb_id="0068646", title="The Godfather", rating=9.2, years="1972"),
        "https://www.imdb.com/title/tt0068646/": make_result(
            imdb_id="0068646", title="The Godfather", rating=9.2, years="1972"),
    }, refresh={"0111161": {"rating": 9.3}, "8910922": {"rating": 8.8, "seasons": 3}})
    monkeypatch.setattr(media_items, "_default_scraper", lambda: sb.scraper)

    seed_exercise(sb)
    seed_timekeeper(sb)
    seed_projectmanager(sb)
    seed_imdbspy(sb)
    seed_recipes(sb)
    seed_calendar(sb)
    seed_artifacts(sb)
    seed_mailbox(sb)
    monkeypatch.setattr(mailbox_tools, "_messages", sb.mail)
    monkeypatch.setattr(mailbox_tools, "_mailops", sb.mail)
    return sb
