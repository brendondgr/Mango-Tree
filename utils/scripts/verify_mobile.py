"""Mobile usability gate — real taps, not assertions about CSS.

Rendering correctly and being usable are different things. A `position: fixed`
wrapper can cover the viewport while every pixel underneath still paints, so a
screenshot looks perfect and no tap reaches anything. This script checks what a
finger actually hits.

    MANGO_AUDIT_USER=me MANGO_AUDIT_PASSWORD=... \
        uv run utils/scripts/verify_mobile.py

Exits non-zero if any check fails. Run it after every change to the shell.
"""

from __future__ import annotations

import argparse
import os
import pathlib
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover - dependency hint
    sys.exit("playwright is not installed. Run: uv pip install playwright && playwright install chromium")

DEFAULT_BASE = os.environ.get("MANGO_AUDIT_BASE", "http://localhost:5173")
USER = os.environ.get("MANGO_AUDIT_USER", "")
PASSWORD = os.environ.get("MANGO_AUDIT_PASSWORD", "")

ANDROID_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

HIT_TEST_JS = """(sel) => {
  const target = document.querySelector(sel);
  if (!target) return { error: 'not found: ' + sel };
  const r = target.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(r.top + r.height / 2);
  const hit = document.elementFromPoint(x, y);
  const describe = (e) => e.tagName.toLowerCase() +
    (e.id ? '#' + e.id : '') +
    (e.className ? '.' + String(
      e.className.baseVal !== undefined ? e.className.baseVal : e.className
    ).trim().split(/\\s+/).slice(0, 3).join('.') : '');
  return {
    x, y,
    hit: hit ? describe(hit) : null,
    reachesTarget: hit ? (target.contains(hit) || hit === target) : false,
    rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) },
    inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
  };
}"""


class Checks:
    def __init__(self) -> None:
        self.results: list[tuple[bool, str, str]] = []

    def add(self, ok: bool, name: str, detail: str = "") -> None:
        self.results.append((ok, name, detail))
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"\n          {detail}" if detail else ""))

    @property
    def failed(self) -> int:
        return sum(1 for ok, _, _ in self.results if not ok)


def run(base: str, width: int, height: int, shot_dir: pathlib.Path | None) -> int:
    checks = Checks()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            has_touch=True,
            is_mobile=True,
            user_agent=ANDROID_UA,
        )
        page = ctx.new_page()
        page.goto(base, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

        if page.locator('input[name="username"], #username').count():
            if not USER or not PASSWORD:
                sys.exit("Set MANGO_AUDIT_USER and MANGO_AUDIT_PASSWORD.")
            page.fill('input[name="username"], #username', USER)
            page.fill('input[name="password"], #password', PASSWORD)
            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)

        print(f"\n=== mobile gate @ {width}x{height} ===")

        # 1. The landing surface must accept taps.
        card = "main ul > li:first-child button, main [data-app-launcher] button"
        hit = page.evaluate(HIT_TEST_JS, card)
        checks.add(
            bool(hit.get("reachesTarget")),
            "landing: a tap reaches the first app launcher card",
            f"tap at ({hit.get('x')},{hit.get('y')}) landed on {hit.get('hit')}"
            if not hit.get("reachesTarget") else "",
        )

        # 2. And a real tap must actually do something.
        try:
            page.locator(card).first.tap(timeout=4000)
            page.wait_for_timeout(1500)
            checks.add(True, "landing: real tap on the launcher card dispatches")
        except Exception as exc:
            checks.add(False, "landing: real tap on the launcher card dispatches",
                       str(exc).splitlines()[0][:120])

        # 3. The chat surface must be reachable and usable.
        opened = False
        for label in ("Chat", "Open chat"):
            control = page.locator(f'[aria-label="{label}"]').first
            if control.count():
                try:
                    control.tap(timeout=4000)
                    page.wait_for_timeout(1200)
                    opened = True
                    break
                except Exception:
                    continue
        checks.add(opened, "chat: the chat control can be activated")

        hit = page.evaluate(HIT_TEST_JS, "textarea")
        checks.add(
            bool(hit.get("reachesTarget")),
            "chat: a tap reaches the composer textarea",
            f"tap at ({hit.get('x')},{hit.get('y')}) landed on {hit.get('hit')}"
            if not hit.get("reachesTarget") else "",
        )

        typed = ""
        try:
            page.locator("textarea").first.tap(timeout=4000)
            page.wait_for_timeout(400)
            page.keyboard.type("mobile gate")
            page.wait_for_timeout(400)
            typed = page.evaluate("() => document.querySelector('textarea')?.value || ''")
        except Exception as exc:
            typed = f"<error: {str(exc).splitlines()[0][:80]}>"
        checks.add(typed == "mobile gate", "chat: text can be typed into the composer",
                   f"textarea value was {typed!r}" if typed != "mobile gate" else "")

        # 4. The send affordance must be on-screen.
        send = page.evaluate("""() => {
            const b = [...document.querySelectorAll('button')].find(
              e => /send/i.test(e.textContent || e.getAttribute('aria-label') || ''));
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { bottom: Math.round(r.bottom), viewport: window.innerHeight,
                     visible: r.bottom <= window.innerHeight && r.top >= 0 };
        }""")
        checks.add(
            bool(send and send.get("visible")),
            "chat: the send control is inside the viewport",
            f"send bottom={send['bottom']}px, viewport={send['viewport']}px" if send else "no send control found",
        )

        # 5. No horizontal page scroll.
        scroll = page.evaluate(
            "() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })"
        )
        checks.add(scroll["s"] <= scroll["c"] + 1, "layout: no horizontal page scroll",
                   f"scrollWidth={scroll['s']} clientWidth={scroll['c']}")

        if shot_dir:
            shot_dir.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(shot_dir / f"mobile-gate-{width}x{height}.png"))
        browser.close()

    print(f"\n{len(checks.results) - checks.failed}/{len(checks.results)} checks passed")
    return 1 if checks.failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--height", type=int, default=844)
    parser.add_argument("--shots", default=None, help="directory for screenshots")
    args = parser.parse_args()
    return run(args.base, args.width, args.height,
               pathlib.Path(args.shots) if args.shots else None)


if __name__ == "__main__":
    sys.exit(main())
