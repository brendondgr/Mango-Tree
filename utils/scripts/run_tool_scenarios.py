#!/usr/bin/env python
"""Run the tool scenario suite and print where the report landed.

A thin wrapper over pytest (the sandbox is a pytest fixture) that picks the
mode, narrows the catalog, and points the report at a directory per run.

    uv run utils/scripts/run_tool_scenarios.py                       # scripted, everything
    uv run utils/scripts/run_tool_scenarios.py --only exercise imdbspy
    uv run utils/scripts/run_tool_scenarios.py --mode auto           # scripted, automatic selection
    MANGO_LIVE_LLM=1 uv run utils/scripts/run_tool_scenarios.py --mode live --only selection
    uv run utils/scripts/run_tool_scenarios.py --mode router          # the live router alone

See docs/tool-scenarios.md.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TESTS = {
    "scripted": ["utils/tests/scenarios/test_catalog_scripted.py"],
    "auto": ["utils/tests/scenarios/test_catalog_auto.py"],
    "live": ["utils/tests/scenarios/test_catalog_live.py"],
    "router": ["utils/tests/scenarios/test_router_live.py"],
    "all": ["utils/tests/scenarios"],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", choices=sorted(TESTS), default="scripted")
    parser.add_argument("--only", nargs="*", default=[],
                        help="scenario id prefixes, tags or groups (e.g. exercise imdbspy mixed)")
    parser.add_argument("--report", default=None, help="report directory (default .tool-scenarios/<mode>-<timestamp>)")
    parser.add_argument("--provider", default=None, help="live modes: provider slug from the registry")
    parser.add_argument("--model", default=None, help="live modes: model id")
    parser.add_argument("-x", "--exitfirst", action="store_true")
    args = parser.parse_args()

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report = Path(args.report) if args.report else REPO / ".tool-scenarios" / f"{args.mode}-{stamp}"

    env = dict(os.environ)
    env["MANGO_SCENARIO_REPORT_DIR"] = str(report.parent)
    if args.mode in ("live", "router"):
        env["MANGO_LIVE_LLM"] = "1"
    if args.provider:
        env["MANGO_LIVE_PROVIDER"] = args.provider
    if args.model:
        env["MANGO_LIVE_MODEL"] = args.model
    if args.only:
        env["MANGO_SCENARIO_ONLY"] = ",".join(args.only)

    cmd = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *TESTS[args.mode]]
    if args.exitfirst:
        cmd.append("-x")
    if args.only and args.mode not in ("live",):
        cmd += ["-k", " or ".join(args.only)]

    print("$", " ".join(cmd))
    code = subprocess.call(cmd, cwd=REPO, env=env)
    written = report.parent / "pytest"
    if (written / "report.md").exists():
        target = report
        target.mkdir(parents=True, exist_ok=True)
        for name in ("report.md", "traces.json"):
            (written / name).replace(target / name)
        print(f"\nReport: {target / 'report.md'}")
    else:
        print("\nNo report was written (no scenario ran).")
    return code


if __name__ == "__main__":
    sys.exit(main())
