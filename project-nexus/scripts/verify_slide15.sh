#!/usr/bin/env bash
# Project Nexus — one command to verify Cursor IDE (Slide 15)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 build/arc_orchestrator.py --slides 15 "$@"
