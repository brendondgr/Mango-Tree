#!/usr/bin/env python3
"""Create the runtime state a clean clone does not have.

``data/`` is gitignored, so a fresh clone has no directories and no databases.
Django's ``migrate`` creates a missing SQLite *file* but never a missing
*directory*, and the three legacy-bound apps own schemas Django is forbidden to
migrate — so without this step ``manage.py migrate --database=imdbspy`` fails
outright and 170 tests error on a missing source file.

Run it from a clean clone, or any time, or twice:

    uv run utils/scripts/init_data.py
    uv run utils/scripts/init_data.py --verbose

**It never touches an existing database.** Every app is skipped when its file is
already there, so this is safe to re-run against a live install — which is the
point, because ``scripts/bootstrap`` calls it on every run.

Schemas for exercise, projectmanager and timekeeper are created directly from
their ``managed = False`` models with Django's schema editor. That deliberately
does NOT generate a migration: those models bind to databases a previous app
created, and a migration against real data would corrupt it. Creating tables in
a file that does not yet exist is a different operation and carries none of that
risk.

Exits non-zero if anything could not be created.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.django.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.db import connections  # noqa: E402


# The three apps whose schema this script owns. Each is bound managed=False to a
# database a standalone app created; the models are the only description of that
# schema in this repository.
UNMANAGED = {
    "exercise": "utils.apps.exercise.backend.models",
    "projectmanager": "utils.apps.projectmanager.backend.models",
    "timekeeper": "utils.apps.timekeeper.backend.models",
}


def _rel(path: Path) -> str:
    """Path relative to the repo when it is inside it, absolute otherwise — the
    MANGO_*_DB overrides legitimately point outside the tree."""
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _models_for(alias: str):
    from django.apps import apps as django_apps

    return [m for m in django_apps.get_app_config(alias).get_models()]


def _create_unmanaged_schema(alias: str, verbose: bool) -> None:
    """Create every table for ``alias`` in its (empty, just-created) database."""
    conn = connections[alias]
    with conn.schema_editor() as editor:
        for model in _models_for(alias):
            editor.create_model(model)
            if verbose:
                print(f"      table {model._meta.db_table}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--verbose", action="store_true", help="name every directory and table")
    args = ap.parse_args()

    made_dirs: list[str] = []
    made_dbs: list[str] = []
    kept: list[str] = []
    failed: list[tuple[str, str]] = []

    # 1. Directories. Every DATABASES entry under data/, plus the artifact store.
    wanted = {Path(settings.DATABASES[a]["NAME"]).parent for a in settings.DATABASES}
    wanted.add(ROOT / "data" / "artifacts")
    for d in sorted(wanted):
        if d == ROOT:
            continue  # the `default` DB lives at the repo root, which exists
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            made_dirs.append(_rel(d))
        elif args.verbose:
            print(f"  dir  {_rel(d)} (exists)")

    # 2. Schemas for the legacy-bound apps, only where there is no file yet.
    for alias in UNMANAGED:
        path = Path(settings.DATABASES[alias]["NAME"])
        if path.exists():
            kept.append(alias)
            continue
        try:
            if args.verbose:
                print(f"  db   {alias} -> {path}")
            _create_unmanaged_schema(alias, args.verbose)
            made_dbs.append(alias)
        except Exception as exc:  # noqa: BLE001 - reported, not swallowed
            failed.append((alias, str(exc)))

    # 3. Recipes owns its own seed-on-first-run path; reuse it rather than
    #    duplicating the schema here.
    recipes_path = Path(settings.DATABASES["recipes"]["NAME"])
    if recipes_path.exists():
        kept.append("recipes")
    else:
        try:
            from utils.apps.recipes.backend.services import store

            store.ensure_initialized()
            made_dbs.append("recipes")
        except Exception as exc:  # noqa: BLE001
            failed.append(("recipes", str(exc)))

    print(f"directories created: {len(made_dirs)}" + (f" ({', '.join(made_dirs)})" if made_dirs else ""))
    print(f"databases created:   {len(made_dbs)}" + (f" ({', '.join(sorted(made_dbs))})" if made_dbs else ""))
    print(f"left alone:          {len(kept)}" + (f" ({', '.join(sorted(kept))})" if kept else ""))
    print("imdbspy owns managed models; `manage.py migrate --database=imdbspy` builds it.")

    for alias, err in failed:
        print(f"FAILED {alias}: {err}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
