#!/usr/bin/env bash
# Lighthouse ↔ Frontier Syntax integration verification gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTIER="${FRONTIER_HOME:-$ROOT/vendor/frontier-syntax}"
REPORT="$ROOT/audit_reports/lighthouse_verify_report.md"

mkdir -p "$ROOT/audit_reports"

pass=0
fail=0
results=()

check_cmd() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    results+=("✅ $name")
    pass=$((pass + 1))
  else
    results+=("❌ $name")
    fail=$((fail + 1))
  fi
}

check_file() {
  local name="$1" path="$2"
  if [[ -f "$path" && -s "$path" ]]; then
    results+=("✅ $name")
    pass=$((pass + 1))
  else
    results+=("❌ $name — missing $path")
    fail=$((fail + 1))
  fi
}

check_file "Frontier bridge" "$ROOT/lib/frontier.js"
check_file "Discovery engine" "$ROOT/lib/discovery-engine.js"
check_file "Browser compiler UI" "$ROOT/public/browser-compiler.js"
check_file "Download menu" "$ROOT/public/download-menu.js"
check_file "Assembly script" "$ROOT/assemble.js"
check_file "Token table" "$ROOT/public/syntax/token_regex_table.json"
check_file "Package registry" "$ROOT/registry/packages.json"
check_file "Taylor closeout" "$ROOT/scripts/taylor_lighthouse_closeout.py"

if [[ -d "$FRONTIER" ]]; then
  check_cmd "Lighthouse stack verify" python3 "$FRONTIER/scripts/verify_lighthouse_stack.py"
  check_cmd "Knowledge bridge" python3 "$FRONTIER/scripts/lighthouse_knowledge_bridge.py"
else
  results+=("❌ frontier-syntax vendor — missing $FRONTIER")
  fail=$((fail + 1))
fi

check_cmd "Node module load" node -e "require('$ROOT/lib/frontier'); require('$ROOT/lib/discovery-engine'); require('$ROOT/lib/package-registry')"

{
  echo "# Lighthouse Frontier Integration — Verify Report"
  echo ""
  echo "**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Result:** $([[ $fail -eq 0 ]] && echo PASS || echo FAIL) ($pass pass, $fail fail)"
  echo ""
  for r in "${results[@]}"; do echo "- $r"; done
} > "$REPORT"

echo "Lighthouse verify: $pass pass, $fail fail"
for r in "${results[@]}"; do echo "  $r"; done
echo "Report: $REPORT"

[[ $fail -eq 0 ]]
