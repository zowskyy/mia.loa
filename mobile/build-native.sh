#!/bin/bash
# Build Frontier Mobile Runtime for all targets
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT/mobile/frontier-runtime"
OUTPUT_DIR="$ROOT/releases/native"

echo "🏗️  Building Frontier Mobile Runtime..."
echo "   Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

export PATH="${HOME}/.cargo/bin:/usr/local/cargo/bin:${PATH}"

if ! command -v cargo >/dev/null 2>&1; then
  echo "❌ cargo not found — install Rust: https://rustup.rs"
  exit 1
fi

cd "$RUNTIME_DIR"

build_target() {
  local name="$1"
  shift
  echo ""
  echo "📦 $name"
  if cargo build --release "$@"; then
    echo "   ✅ $name"
    return 0
  fi
  echo "   ⚠️  $name skipped"
  return 1
}

# Desktop (always — for tests and CI smoke)
build_target "Desktop" || true
DESKTOP_SO="$RUNTIME_DIR/target/release/libfrontier_app.so"
DESKTOP_DYLIB="$RUNTIME_DIR/target/release/libfrontier_app.dylib"
mkdir -p "$OUTPUT_DIR/desktop"
[[ -f "$DESKTOP_SO" ]] && cp "$DESKTOP_SO" "$OUTPUT_DIR/desktop/"
[[ -f "$DESKTOP_DYLIB" ]] && cp "$DESKTOP_DYLIB" "$OUTPUT_DIR/desktop/"

copy_android() {
  local target="$1"
  local arch_dir="$2"
  local lib="$RUNTIME_DIR/target/$target/release/libfrontier_app.so"
  if [[ -f "$lib" ]]; then
    mkdir -p "$OUTPUT_DIR/$arch_dir"
    cp "$lib" "$OUTPUT_DIR/$arch_dir/libfrontier_app.so"
    echo "   📱 $arch_dir"
  fi
}

if rustup target list --installed | grep -q aarch64-linux-android; then
  build_target "Android ARM64" --target aarch64-linux-android && copy_android aarch64-linux-android arm64-v8a
  build_target "Android ARMv7" --target armv7-linux-androideabi && copy_android armv7-linux-androideabi armeabi-v7a
  build_target "Android x86_64" --target x86_64-linux-android && copy_android x86_64-linux-android x86_64
else
  echo ""
  echo "⏭️  Android targets not installed — run:"
  echo "    rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android"
  echo "    # plus NDK (see mobile/frontier-runtime/README.md)"
fi

if rustup target list --installed | grep -q aarch64-apple-ios; then
  build_target "iOS ARM64" --target aarch64-apple-ios
  IOS_LIB="$RUNTIME_DIR/target/aarch64-apple-ios/release/libfrontier_app.a"
  if [[ -f "$IOS_LIB" ]]; then
    mkdir -p "$OUTPUT_DIR/ios"
    cp "$IOS_LIB" "$OUTPUT_DIR/ios/libfrontier_app.a"
  fi
else
  echo ""
  echo "⏭️  iOS target not installed (requires macOS linker for full build)"
fi

echo ""
echo "📊 Binary sizes:"
find "$OUTPUT_DIR" -type f -exec ls -lh {} \;
echo ""
echo "✅ Frontier native libraries built → $OUTPUT_DIR"
