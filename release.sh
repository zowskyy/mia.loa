#!/usr/bin/env bash
# Lighthouse release builder wrapper
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$DIR/release.js" ]; then
  echo "Error: release.js not found. Run from the lighthouse directory."
  exit 1
fi
node "$DIR/release.js" "$@"
