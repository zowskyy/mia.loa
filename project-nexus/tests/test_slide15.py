#!/usr/bin/env python3
"""Tests for Project Nexus Slide 15 Cursor IDE verification."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORCH = ROOT / "build" / "arc_orchestrator.py"
CURSOR = ROOT / "cursor" / "src"


class TestSlide15(unittest.TestCase):
    def test_required_frontier_files_exist(self):
        required = [
            "app.frontier",
            "editor/core.frontier",
            "ai/engine.frontier",
            "ai/chat.frontier",
            "explorer/explorer.frontier",
            "terminal/terminal.frontier",
            "lsp/services.frontier",
            "build/system.frontier",
            "optimization/performance.frontier",
            "ui/visual.frontier",
        ]
        for rel in required:
            path = CURSOR / rel
            self.assertTrue(path.is_file(), f"missing {rel}")
            self.assertGreater(path.stat().st_size, 100)

    def test_no_cpp_under_cursor(self):
        foreign = list((ROOT / "cursor").rglob("*.cpp")) + list((ROOT / "cursor").rglob("*.h"))
        self.assertEqual(foreign, [])

    def test_gates_manifest(self):
        gates = json.loads((ROOT / "gates" / "slide_15_gates.json").read_text(encoding="utf-8"))
        self.assertEqual(gates["slide"], 15)
        self.assertGreaterEqual(len(gates["gates"]), 7)

    def test_orchestrator_slide_15_passes(self):
        proc = subprocess.run(
            [sys.executable, str(ORCH), "--slides", "15"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("SLIDE 15 PASSED", proc.stdout)

        report = ROOT / "audit_reports" / "slide_15_report.json"
        self.assertTrue(report.is_file())
        data = json.loads(report.read_text(encoding="utf-8"))
        self.assertTrue(data["passed"])
        self.assertGreaterEqual(len(data["components"]), 10)


if __name__ == "__main__":
    unittest.main()
