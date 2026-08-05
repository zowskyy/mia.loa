#!/usr/bin/env bash
# Project Nexus — Spirits Within benchmark verification
set -euo pipefail
cd "$(dirname "$0")/.."
python3 build/arc_orchestrator.py --benchmark spirits_within "$@"
