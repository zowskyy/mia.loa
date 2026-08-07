# Lighthouse Mobile Stacks

Two mobile paths — **Frontier native is default** (no WebView).

| Stack | Path | APK size | Runtime |
|-------|------|----------|---------|
| **Frontier native** (default) | `mobile/frontier-runtime/` + `android-shell/` | ~3MB | Compiled machine code |
| Capacitor (legacy) | `mobile/capacitor/` | ~50MB | WebView + JavaScript |

## Frontier native (recommended)

```bash
bash mobile/build-native.sh              # Build libfrontier_app.so
node release.js android-arm64            # Package native APK
node release.js ios                      # Package iOS shell + static lib
```

Set `LIGHTHOUSE_MOBILE=capacitor` to use the legacy WebView stack.

## Pipeline

```
Lighthouse ARC → app.fr
       ↓
Frontier compiler (external) → native code
       ↓
frontier-mobile-runtime (~200KB)
       ↓
Kotlin/Swift shell (~50 lines)
       ↓
3MB APK — runs on Android 5+, bare-metal ARM
```

## On-device AI

Rebuild runtime with `cargo build --release --features ai` when llama.cpp bindings are linked.
