#!/usr/bin/env bash
# Sync Frontier-Syntax assets into Lighthouse public/syntax/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/syntax"
FRONTIER_HOME="${FRONTIER_HOME:-/tmp/frontier-syntax}"
REPO="${FRONTIER_REPO:-https://github.com/zowskyy/frontier-syntax.git}"

mkdir -p "$DEST"

if [[ ! -d "$FRONTIER_HOME/.git" ]]; then
  echo "Cloning $REPO ..."
  git clone --depth 1 "$REPO" "$FRONTIER_HOME"
fi

for file in token_regex_table.json lexicon.ebnf wasm_parser.wasm wasm_compiler.wasm frontier_compiler.wasm; do
  src="$FRONTIER_HOME/syntax/$file"
  if [[ -f "$src" ]]; then
    cp "$src" "$DEST/$file"
    echo "✅ $file"
  else
    echo "⏭️  $file (not in frontier-syntax yet)"
  fi
done

echo "Done — assets in $DEST"
