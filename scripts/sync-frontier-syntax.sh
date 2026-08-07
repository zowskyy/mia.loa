#!/usr/bin/env bash
# Sync Frontier-Syntax assets into Lighthouse public/syntax/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/syntax"
FRONTIER_HOME="${FRONTIER_HOME:-$ROOT/vendor/frontier-syntax}"
REPO="${FRONTIER_REPO:-https://github.com/zowskyy/frontier-syntax.git}"

mkdir -p "$DEST"

if [[ ! -d "$FRONTIER_HOME" ]]; then
  echo "Cloning $REPO ..."
  git clone --depth 1 "$REPO" "$FRONTIER_HOME"
fi

for file in token_regex_table.json lexicon.ebnf grammar.g4 ast_sample.json wasm_parser.wasm wasm_compiler.wasm frontier_compiler.wasm; do
  src="$FRONTIER_HOME/syntax/$file"
  if [[ -f "$src" ]]; then
    cp "$src" "$DEST/$file"
    echo "✅ $file"
  else
    # WASM may live in wasm-playground after build-wasm.sh
    wasm_src="$FRONTIER_HOME/wasm-playground/$file"
    if [[ -f "$wasm_src" ]]; then
      cp "$wasm_src" "$DEST/$file"
      echo "✅ $file (from wasm-playground)"
    else
      echo "⏭️  $file (not in frontier-syntax yet)"
    fi
  fi
done

if [[ -f "$FRONTIER_HOME/syntax/cycle2/extensions.json" ]]; then
  cp "$FRONTIER_HOME/syntax/cycle2/extensions.json" "$DEST/cycle2_extensions.json"
  echo "✅ cycle2_extensions.json"
fi

echo "Done — assets in $DEST"
