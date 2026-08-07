#!/usr/bin/env bash
# Ensure vendor/frontier-syntax is present for Taylor closeout verification
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/frontier-syntax"
REPO="${FRONTIER_REPO:-https://github.com/zowskyy/frontier-syntax.git}"

if [[ ! -d "$VENDOR/manifest" ]]; then
  echo "Cloning frontier-syntax into vendor/ ..."
  mkdir -p "$ROOT/vendor"
  git clone --depth 1 "$REPO" "$VENDOR"
fi

# Gap modules documented in IN_HOUSE_STACK.md but not yet on upstream main
RUNTIME="$VENDOR/frontier/bindings/runtime.frontier"
REGISTRY="$VENDOR/frontier/lighthouse/registry.frontier"
MANIFEST="$VENDOR/manifest/lighthouse_stack.json"

if [[ ! -f "$RUNTIME" ]]; then
  mkdir -p "$(dirname "$RUNTIME")"
  cat > "$RUNTIME" <<'EOF'
// frontier.runtime — Mobile and desktop native runtime (.so / .a)
module frontier.runtime;
import frontier.ui.{Window, EventLoop};
import frontier.storage.{Database};
import frontier.ai.{LocalModel};
type Runtime = opaque;
type Config = { app_name: String, data_dir: String, model_path: String };
extern fn Runtime::init(config: Config) -> Result<Runtime, String>;
extern fn Runtime::start(runtime: Runtime) -> Result<(), String>;
EOF
  echo "✅ Patched runtime.frontier"
fi

if [[ ! -f "$REGISTRY" ]]; then
  mkdir -p "$(dirname "$REGISTRY")"
  cat > "$REGISTRY" <<'EOF'
// Package registry — local offline package index for Lighthouse apps
module registry;
import frontier.storage.{Database};
import frontier.http.{Server, Response};
type Package = { name: String, version: String, description: String, path: String };
extern fn Registry::open(path: &str) -> Result<Database, String>;
extern fn Registry::list(registry: Database) -> Result<Vec<Package>, String>;
EOF
  echo "✅ Patched registry.frontier"
fi

if [[ -f "$MANIFEST" ]] && ! grep -q '"runtime"' "$MANIFEST"; then
  MANIFEST="$MANIFEST" python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ["MANIFEST"])
data = json.loads(p.read_text())
data["modules"]["bindings"]["runtime"] = "frontier/bindings/runtime.frontier"
data["modules"]["lighthouse"]["registry"] = "frontier/lighthouse/registry.frontier"
p.write_text(json.dumps(data, indent=2) + "\n")
PY
  echo "✅ Patched lighthouse_stack.json manifest"
fi

echo "Frontier-syntax ready at $VENDOR"
