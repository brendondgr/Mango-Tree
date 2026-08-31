"""Authenticated UI audit of the running Mango Tree workspace.

Logs in, walks every workspace surface at several viewports, and on each one
measures: axe-core violations, horizontal overflow, touch-target sizes, input
font sizes, and tab-order shape. Emits JSON plus a screenshot per surface and
viewport, so a finding can be reproduced months later.

The workspace is auth-gated, so a plain crawler sees only the login page. This
script signs in first, which is the whole reason it exists.

    # once
    uv pip install playwright && playwright install chromium
    cd web && npm install          # provides axe-core

    # with `python run.py` already serving 5173
    MANGO_AUDIT_USER=me MANGO_AUDIT_PASSWORD=... \
        uv run utils/scripts/audit_ui.py --out .audit/baseline

Exits non-zero when a hard failure is measured (page-level horizontal scroll,
or an axe violation of critical impact), so it can gate a deploy.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover - dependency hint
    sys.exit("playwright is not installed. Run: uv pip install playwright && playwright install chromium")

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
AXE_PATH = REPO_ROOT / "web" / "node_modules" / "axe-core" / "axe.min.js"

DEFAULT_BASE = os.environ.get("MANGO_AUDIT_BASE", "http://localhost:5173")
USER = os.environ.get("MANGO_AUDIT_USER", "")
PASSWORD = os.environ.get("MANGO_AUDIT_PASSWORD", "")

# (surface id, human label, nav-rail aria-label to activate). None = landing.
SURFACES: list[tuple[str, str, str | None]] = [
    ("apps", "Apps home", None),
    ("mailbox", "Mailbox", "Mailbox"),
    ("exercise", "Exercise", "Exercise"),
    ("projectmanager", "Projects", "Projects"),
    ("calendar", "Calendar", "Calendar"),
    ("imdbspy", "IMDbSpy", "IMDbSpy"),
    ("recipes", "Recipes", "Recipes"),
    ("mediaviewer", "Artifacts", "Artifacts"),
    ("timekeeper", "Time Keeper", "Time Keeper"),
]

VIEWPORTS: dict[str, tuple[int, int]] = {
    "320x568": (320, 568),
    "360x740": (360, 740),
    "390x844": (390, 844),
    "412x915": (412, 915),
    "768x1024": (768, 1024),
    "1280x800": (1280, 800),
    "1920x1080": (1920, 1080),
}

DEFAULT_VIEWPORTS = "360x740,768x1024,1280x800"

# --- probes -----------------------------------------------------------------

OVERFLOW_JS = """() => {
  const d = document.documentElement;
  const limit = d.clientWidth + 1;
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Only elements spilling past the RIGHT edge are defects. Elements at
    // negative left are usually an intentionally off-canvas drawer.
    if (r.right > limit) {
      out.push({
        tag: e.tagName.toLowerCase(),
        cls: String(e.className && e.className.baseVal !== undefined
          ? e.className.baseVal : e.className || '').slice(0, 100),
        right: Math.round(r.right), w: Math.round(r.width),
      });
    }
  }
  return {
    scrollW: d.scrollWidth,
    clientW: d.clientWidth,
    pageScrolls: d.scrollWidth > d.clientWidth,
    count: out.length,
    sample: out.slice(0, 12),
  };
}"""

TARGET_JS = """() => {
  const SEL = 'a[href], button, input, select, textarea, [role="button"],' +
    '[role="tab"], [role="switch"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
  const small = [];
  for (const e of document.querySelectorAll(SEL)) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const tier = (r.width < 24 || r.height < 24) ? 'under24'
      : (r.width < 44 || r.height < 44) ? 'under44' : null;
    if (!tier) continue;
    small.push({
      tag: e.tagName.toLowerCase(),
      label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40),
      w: Math.round(r.width), h: Math.round(r.height), tier,
    });
  }
  return {
    total: document.querySelectorAll(SEL).length,
    under24: small.filter(s => s.tier === 'under24').length,
    under44: small.filter(s => s.tier === 'under44').length,
    sample: small.slice(0, 25),
  };
}"""

SMALL_INPUT_JS = """() => {
  // iOS Safari auto-zooms when a focused control renders below 16px.
  const out = [];
  for (const e of document.querySelectorAll('input, textarea, select')) {
    if (e.getBoundingClientRect().width === 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 16) out.push({ tag: e.tagName.toLowerCase(), name: e.name || e.id || '', fontSize: fs });
  }
  return out;
}"""

FOCUS_JS = """() => {
  const SEL = 'a[href], button:not([disabled]), input:not([disabled]),' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const all = [...document.querySelectorAll(SEL)];
  const visible = all.filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  });
  // Focusable but not visible: off-canvas drawers and collapsed panels that
  // never left the tab order.
  const offscreen = all.filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right < 0 || r.left > document.documentElement.clientWidth);
  }).length;
  const insideAriaHidden = [...document.querySelectorAll('[aria-hidden="true"]')]
    .flatMap(h => [...h.querySelectorAll(SEL)])
    .filter(e => e.getBoundingClientRect().width > 0).length;
  return {
    tabbable: visible.length,
    positiveTabindex: visible.filter(e => Number(e.getAttribute('tabindex')) > 0).length,
    focusableOffscreen: offscreen,
    focusableInsideAriaHidden: insideAriaHidden,
    firstFive: visible.slice(0, 5).map(e =>
      (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30)),
  };
}"""

AXE_JS = """async () => {
  const r = await axe.run(document, {
    resultTypes: ['violations'],
    runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] },
  });
  return r.violations.map(v => ({
    id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
    targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')),
  }));
}"""


def login(page, base: str) -> None:
    page.goto(base, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    if page.locator('input[name="username"], #username').count():
        if not USER or not PASSWORD:
            sys.exit(
                "The workspace is auth-gated. Set MANGO_AUDIT_USER and "
                "MANGO_AUDIT_PASSWORD to an existing owner account."
            )
        page.fill('input[name="username"], #username', USER)
        page.fill('input[name="password"], #password', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)


def open_surface(page, rail_label: str) -> bool:
    """Open an app surface in whichever shell is active.

    The expanded shell has a persistent icon rail; the compact shell keeps the
    app list in a sheet behind "More". Matching by accessible name works for
    both, so the audit covers the same nine surfaces either way.
    """
    button = page.get_by_role("button", name=rail_label, exact=True).first
    if button.count() == 0:
        # Compact shell: reveal the app list first.
        more = page.get_by_role("button", name="More", exact=True).first
        if more.count() == 0:
            return False
        try:
            more.click(timeout=4000)
            page.wait_for_timeout(600)
        except Exception:
            return False
        button = page.get_by_role("button", name=rail_label, exact=True).first
        if button.count() == 0:
            page.keyboard.press("Escape")
            return False
    try:
        button.click(timeout=4000)
    except Exception:
        return False
    page.wait_for_timeout(1800)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", default=".audit/run", help="output directory")
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--viewports", default=DEFAULT_VIEWPORTS,
                        help=f"comma list from: {', '.join(VIEWPORTS)}")
    parser.add_argument("--surfaces", default=None, help="comma list of surface ids")
    parser.add_argument("--no-axe", action="store_true")
    parser.add_argument("--no-shots", action="store_true")
    args = parser.parse_args()

    out = pathlib.Path(args.out)
    (out / "shots").mkdir(parents=True, exist_ok=True)

    axe_src = None
    if not args.no_axe:
        if not AXE_PATH.exists():
            print(f"note: {AXE_PATH} missing — run `cd web && npm install`. Skipping axe.")
        else:
            axe_src = AXE_PATH.read_text()

    unknown = set(args.viewports.split(",")) - set(VIEWPORTS)
    if unknown:
        sys.exit(f"unknown viewport(s): {', '.join(sorted(unknown))}")
    viewports = {k: VIEWPORTS[k] for k in args.viewports.split(",")}

    surfaces = SURFACES
    if args.surfaces:
        want = set(args.surfaces.split(","))
        surfaces = [s for s in SURFACES if s[0] in want]

    report: dict = {"base": args.base, "viewports": list(viewports), "surfaces": {}}
    console: list[str] = []
    hard_failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp_name, (w, h) in viewports.items():
            ctx = browser.new_context(viewport={"width": w, "height": h})
            page = ctx.new_page()
            page.on("console", lambda m, v=vp_name:
                    console.append(f"{v} [{m.type}] {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e, v=vp_name: console.append(f"{v} [pageerror] {e}"))
            login(page, args.base)

            for sid, _label, rail in surfaces:
                if rail is not None and not open_surface(page, rail):
                    report["surfaces"].setdefault(sid, {})[vp_name] = {"error": "nav control not found"}
                    continue
                page.wait_for_timeout(400)

                entry: dict = {
                    "overflow": page.evaluate(OVERFLOW_JS),
                    "targets": page.evaluate(TARGET_JS),
                    "smallInputs": page.evaluate(SMALL_INPUT_JS),
                    "focus": page.evaluate(FOCUS_JS),
                }
                if axe_src:
                    try:
                        page.evaluate(axe_src)
                        entry["axe"] = page.evaluate(AXE_JS)
                    except Exception as exc:
                        entry["axe_error"] = str(exc)
                if not args.no_shots:
                    page.screenshot(path=str(out / "shots" / f"{sid}__{vp_name}.png"))

                report["surfaces"].setdefault(sid, {})[vp_name] = entry

                if entry["overflow"]["pageScrolls"]:
                    hard_failures.append(f"{sid}@{vp_name}: page scrolls horizontally")
                critical = [v for v in entry.get("axe", []) if v["impact"] == "critical"]
                if critical:
                    hard_failures.append(
                        f"{sid}@{vp_name}: critical axe violation(s) "
                        + ", ".join(v["id"] for v in critical)
                    )

                print(
                    f"  {vp_name:10s} {sid:16s} "
                    f"overflow={entry['overflow']['count']:3d} "
                    f"u24={entry['targets']['under24']:3d} "
                    f"u44={entry['targets']['under44']:3d} "
                    f"axe={len(entry.get('axe', [])):3d}",
                    flush=True,
                )
            ctx.close()
        browser.close()

    report["console_errors"] = console
    report["hard_failures"] = hard_failures
    (out / "report.json").write_text(json.dumps(report, indent=2))

    print(f"\nwrote {out / 'report.json'}")
    print(f"console errors: {len(console)}")
    if hard_failures:
        print(f"\nHARD FAILURES ({len(hard_failures)}):")
        for f in hard_failures:
            print(f"  - {f}")
        return 1
    print("no hard failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
