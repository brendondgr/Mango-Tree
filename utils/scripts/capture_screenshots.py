#!/usr/bin/env python3
"""Capture the README's screenshots from a running workspace.

The images in `docs/assets/` are generated, not hand-cropped, so they can be
regenerated when the UI changes instead of quietly going stale.

    MANGO_AUDIT_USER=you MANGO_AUDIT_PASSWORD=yourpassword \
        uv run --extra audit utils/scripts/capture_screenshots.py

**Point this at a throwaway instance, not your own.** Screenshots of a real
install show real mail, real calendar entries and real film ratings. Stand one up
by overriding every database path, so nothing you capture is yours:

    export MANGO_DEFAULT_DB=/tmp/demo/mango.sqlite3
    export MANGO_EXERCISE_DB=/tmp/demo/exercise/workouttracker.db
    export MANGO_PROJECTMANAGER_DB=/tmp/demo/projectmanager/projectmanager.db
    export MANGO_IMDBSPY_DB=/tmp/demo/imdbspy/imdbtracker.db
    export MANGO_TIMEKEEPER_DB=/tmp/demo/timekeeper/timekeeper.db
    export MANGO_RECIPES_DB=/tmp/demo/recipes/recipes.db
    uv run utils/scripts/init_data.py && uv run manage.py migrate
    uv run manage.py migrate --database=imdbspy
    # create an owner, start the servers, then run this script

Needs the audit extra and a browser:

    uv sync --extra audit && uv run playwright install chromium
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("MANGO_AUDIT_BASE", "http://localhost:5173")
USER = os.environ.get("MANGO_AUDIT_USER", "")
PASSWORD = os.environ.get("MANGO_AUDIT_PASSWORD", "")

# (filename, nav-rail label or None for the landing surface, viewport, theme)
SHOTS: list[tuple[str, str | None, tuple[int, int], str]] = [
    ("workspace.png", None, (1440, 900), "default"),
    ("timekeeper.png", "Time Keeper", (1440, 900), "default"),
    ("workspace-dark.png", None, (1440, 900), "blue-dark"),
    ("mobile.png", None, (390, 844), "default"),
]


def login(page) -> None:
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    if page.locator('input[name="username"], #username').count():
        if not USER or not PASSWORD:
            sys.exit(
                "The workspace is auth-gated. Set MANGO_AUDIT_USER and "
                "MANGO_AUDIT_PASSWORD to an owner account on the instance you "
                "are capturing."
            )
        page.fill('input[name="username"], #username', USER)
        page.fill('input[name="password"], #password', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)
    _finish_onboarding(page)


def _finish_onboarding(page) -> None:
    """A first-run account lands in onboarding, not the workspace. Walk it:
    welcome -> app picker (take all of them) -> enter."""
    for _ in range(6):
        if "/onboarding" not in page.url:
            return
        select_all = page.get_by_role("button", name="Select all", exact=True).first
        if select_all.count():
            select_all.click()
            page.wait_for_timeout(300)
        for label in ("Enter workspace", "Continue"):
            button = page.get_by_role("button", name=label, exact=True).first
            if button.count():
                button.click()
                page.wait_for_timeout(1400)
                break
        else:
            return


def set_theme(page, theme: str) -> None:
    page.evaluate(
        """(t) => {
            localStorage.setItem('mango-theme', t);
            document.documentElement.setAttribute('data-theme', t);
        }""",
        theme,
    )
    page.wait_for_timeout(400)


def open_surface(page, label: str) -> bool:
    """Open an app tab in whichever shell is active — the expanded shell has a
    persistent icon rail, the compact one hides the list behind "More"."""
    button = page.get_by_role("button", name=label, exact=True).first
    if button.count() == 0:
        more = page.get_by_role("button", name="More", exact=True).first
        if more.count() == 0:
            return False
        more.click(timeout=4000)
        page.wait_for_timeout(600)
        button = page.get_by_role("button", name=label, exact=True).first
        if button.count() == 0:
            return False
    button.click(timeout=4000)
    page.wait_for_timeout(1800)
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT / "docs" / "assets"))
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, label, (w, h), theme in SHOTS:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            page = ctx.new_page()
            login(page)
            set_theme(page, theme)
            if label and not open_surface(page, label):
                print(f"  skipped {name}: could not open {label!r}", file=sys.stderr)
                ctx.close()
                continue
            page.wait_for_timeout(1200)
            page.screenshot(path=str(out / name))
            written.append(name)
            print(f"  wrote {name}  {w}x{h}  theme={theme}")
            ctx.close()
        browser.close()

    print(f"{len(written)}/{len(SHOTS)} captured into {out}")
    return 0 if len(written) == len(SHOTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
