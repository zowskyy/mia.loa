#!/usr/bin/env python3
"""Tests for Spirits Within benchmark."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORCH = ROOT / "build" / "arc_orchestrator.py"
BENCH = ROOT / "benchmark" / "spirits_within"


class TestSpiritsWithin(unittest.TestCase):
    def test_required_frontier_files_exist(self):
        required = [
            "character.frontier",
            "materials.frontier",
            "volumetrics.frontier",
            "facial.frontier",
            "lip_sync.frontier",
            "scene.frontier",
            "optimization.frontier",
            "benchmark.frontier",
        ]
        for name in required:
            path = BENCH / name
            self.assertTrue(path.is_file(), f"missing {name}")
            self.assertGreater(path.stat().st_size, 200)

    def test_gates_manifest(self):
        gates = json.loads((ROOT / "gates" / "spirits_within_gates.json").read_text(encoding="utf-8"))
        self.assertEqual(gates["benchmark"], "spirits_within")
        self.assertGreaterEqual(len(gates["scripts"]), 6)

    def test_orchestrator_benchmark_passes(self):
        proc = subprocess.run(
            [sys.executable, str(ORCH), "--benchmark", "spirits_within"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("SPIRITS WITHIN BENCHMARK", proc.stdout)
        self.assertIn("ALL ARC GATES PASSED", proc.stdout)

        report = ROOT / "audit_reports" / "spirits_within_report.json"
        self.assertTrue(report.is_file())
        data = json.loads(report.read_text(encoding="utf-8"))
        self.assertTrue(data["passed"])
        self.assertEqual(data["scripts_passed"], 6)

    def test_scene_has_three_characters(self):
        text = (BENCH / "scene.frontier").read_text(encoding="utf-8")
        self.assertGreaterEqual(text.count("PhotorealisticCharacter.load("), 3)

    def test_facial_has_six_emotions(self):
        text = (BENCH / "facial.frontier").read_text(encoding="utf-8")
        for emotion in ("joy", "sadness", "anger", "fear", "disgust", "surprise"):
            self.assertIn(f'"{emotion}"', text)


if __name__ == "__main__":
    unittest.main()
