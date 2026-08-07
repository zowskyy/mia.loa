#!/usr/bin/env bash
# Seal Lighthouse Frontier integration after verify + Taylor crew pass
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRACKING="$ROOT/frontier-closeout/TRACKING.json"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

bash "$ROOT/frontier-closeout/verify.sh"

python3 "$ROOT/scripts/taylor_lighthouse_closeout.py" || {
  echo "Taylor crew verification failed — closeout blocked"
  exit 1
}

mkdir -p "$ROOT/frontier-closeout"
cat > "$TRACKING" <<EOF
{
  "project": "Lighthouse Frontier Integration",
  "version": "1.0.2",
  "status": "closed",
  "closed_at": "$TS",
  "certified_by": "scripts/taylor_lighthouse_closeout.py",
  "stack": "frontier-syntax v2.0.0",
  "verify_script": "frontier-closeout/verify.sh"
}
EOF

echo "{\"ts\":\"$TS\",\"event\":\"project_closed\",\"actor\":\"closeout.sh\",\"detail\":\"verify.sh + Taylor crew passed\"}" \
  >> "$ROOT/frontier-closeout/closeout.log"

echo ""
echo "✅ Lighthouse Frontier integration CLOSED"
echo "   Tracking: $TRACKING"
