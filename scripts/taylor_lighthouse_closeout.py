#!/usr/bin/env python3
"""
Taylor Worker Crew — Lighthouse ↔ Frontier Syntax close-out orchestrator.

Modeled on frontier-syntax/scripts/taylor_frontier_dex_closeout.py.
Runs parallel verification workers against the thin Lighthouse shell and
vendor frontier-syntax stack, then reports readiness for closeout.

Usage:
  python3 scripts/taylor_lighthouse_closeout.py           # dry-run verify
  python3 scripts/taylor_lighthouse_closeout.py --close   # verify + seal
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
FRONTIER = Path(
    __import__("os").environ.get("FRONTIER_HOME", str(ROOT / "vendor" / "frontier-syntax"))
)

# Ensure vendor clone exists before workers run
_ensure = ROOT / "scripts" / "ensure-frontier-syntax.sh"
if _ensure.exists() and not (FRONTIER / "manifest" / "lighthouse_stack.json").exists():
    subprocess.run(["bash", str(_ensure)], cwd=ROOT, check=False)
REPORT = ROOT / "audit_reports" / "lighthouse_closeout_report.md"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run_cmd(cmd: list[str], timeout: int = 600) -> dict[str, Any]:
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        out = (r.stdout + r.stderr).strip()
        return {
            "command": " ".join(cmd),
            "pass": r.returncode == 0,
            "exit_code": r.returncode,
            "output_tail": out[-2000:],
        }
    except Exception as exc:  # noqa: BLE001
        return {"command": " ".join(cmd), "pass": False, "exit_code": -1, "output_tail": str(exc)}


WORKERS: dict[str, list[str]] = {
    "Taylor-1 (lighthouse stack)": [
        sys.executable,
        str(FRONTIER / "scripts" / "verify_lighthouse_stack.py"),
    ],
    "Taylor-2 (knowledge bridge)": [
        sys.executable,
        str(FRONTIER / "scripts" / "lighthouse_knowledge_bridge.py"),
    ],
    "Taylor-3 (syntax sync)": ["bash", str(ROOT / "scripts" / "sync-frontier-syntax.sh")],
    "Taylor-4 (assembly check)": ["node", str(ROOT / "assemble.js"), "--check"],
    "Taylor-5 (module load)": [
        sys.executable,
        "-c",
        f"import pathlib; root=pathlib.Path({str(ROOT)!r}); "
        "req=['lib/frontier.js','lib/discovery-engine.js','lib/package-registry.js',"
        "'public/browser-compiler.js','assemble.js']; "
        "missing=[p for p in req if not (root/p).exists()]; "
        "raise SystemExit(0 if not missing else 1)",
    ],
}


def run_crew() -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(run_cmd, cmd): name for name, cmd in WORKERS.items()}
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            result = future.result()
            result["worker"] = name
            results.append(result)
    return sorted(results, key=lambda r: r["worker"])


def render_report(results: list[dict[str, Any]], closed: bool) -> str:
    all_pass = all(r["pass"] for r in results)
    seal = "CLOSED" if closed and all_pass else ("READY" if all_pass else "BLOCKED")
    lines = [
        "# Lighthouse Taylor Worker Crew — Close-out Report",
        "",
        f"**Generated:** {utc_now()}",
        f"**Seal:** {seal}",
        "",
        "## Worker Results",
        "",
        "| Worker | Status | Command |",
        "|--------|--------|---------|",
    ]
    for r in results:
        mark = "✅ PASS" if r["pass"] else "❌ FAIL"
        cmd = r["command"][:60] + ("…" if len(r["command"]) > 60 else "")
        lines.append(f"| {r['worker']} | {mark} | `{cmd}` |")
    lines.extend(["", "## Output Tails", ""])
    for r in results:
        lines.extend([f"### {r['worker']}", "", "```", r["output_tail"] or "(empty)", "```", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Taylor worker crew — Lighthouse close-out")
    parser.add_argument("--close", action="store_true", help="Run verify.sh + closeout.sh after crew passes")
    args = parser.parse_args()

    print("Taylor Worker Crew — Lighthouse Frontier close-out")
    print("=" * 50)
    results = run_crew()
    all_pass = all(r["pass"] for r in results)

    for r in results:
        mark = "PASS" if r["pass"] else "FAIL"
        print(f"  [{mark}] {r['worker']}")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    closed = False

    if all_pass and args.close:
        print("\nAll workers passed — running verify.sh + closeout seal ...")
        v = run_cmd(["bash", str(ROOT / "frontier-closeout" / "verify.sh")])
        results.append({"worker": "verify.sh", **v})
        if v["pass"]:
            tracking = ROOT / "frontier-closeout" / "TRACKING.json"
            tracking.parent.mkdir(parents=True, exist_ok=True)
            tracking.write_text(
                json.dumps(
                    {
                        "project": "Lighthouse Frontier Integration",
                        "version": "1.0.2",
                        "status": "closed",
                        "closed_at": utc_now(),
                        "certified_by": "scripts/taylor_lighthouse_closeout.py",
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            closed = True
        all_pass = closed

    REPORT.write_text(render_report(results, closed), encoding="utf-8")
    print(f"\nReport: {REPORT.relative_to(ROOT)}")
    print(json.dumps({"ok": all_pass, "closed": closed, "workers": len(WORKERS)}, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
