#!/usr/bin/env python3
"""Tests for 100% Frontier-native AI purge (slices 15.9–15.12)."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORCH = ROOT / "build" / "arc_orchestrator.py"
AI = ROOT / "frontier" / "ai"


class TestNativeAI(unittest.TestCase):
    def test_native_ai_files_exist(self):
        for name in (
            "neural_engine.frontier",
            "language_model.frontier",
            "applications.frontier",
            "training.frontier",
        ):
            path = AI / name
            self.assertTrue(path.is_file(), f"missing {name}")
            self.assertGreater(path.stat().st_size, 500)

    def test_gates_manifest(self):
        gates = json.loads((ROOT / "gates" / "native_ai_gates.json").read_text(encoding="utf-8"))
        self.assertEqual(gates["policy"], "zero-third-party-ai")
        self.assertGreaterEqual(len(gates["required_files"]), 4)

    def test_purge_patch_passes(self):
        proc = subprocess.run(
            [sys.executable, str(ORCH), "--patch", "purge-third-party"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("THIRD-PARTY AI PURGED", proc.stdout)

    def test_slices_15_9_to_15_12_pass(self):
        proc = subprocess.run(
            [sys.executable, str(ORCH), "--slides", "15.9,15.10,15.11,15.12"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("15.9", proc.stdout)
        self.assertIn("15.12", proc.stdout)

    def test_engine_wired_to_frontier_lm(self):
        body = (ROOT / "cursor" / "src" / "ai" / "engine.frontier").read_text(encoding="utf-8")
        self.assertIn("FrontierLM", body)
        self.assertIn("FrontierAI", body)
        self.assertIn("NativeAIPolicy", body)

    def test_grep_clean_outside_allowlist(self):
        proc = subprocess.run(
            [
                "rg",
                "-i",
                r"onnx|openai|tensorflow|pytorch|huggingface|anthropic",
                str(ROOT / "frontier"),
                str(ROOT / "cursor"),
                str(ROOT / "benchmark"),
            ],
            capture_output=True,
            text=True,
        )
        # rg exit 1 = no matches
        self.assertEqual(proc.stdout.strip(), "", proc.stdout)
        self.assertIn(proc.returncode, (0, 1))
        self.assertEqual(proc.returncode, 1, "forbidden terms found in native sources")


if __name__ == "__main__":
    unittest.main()
