# Frontier Mobile Runtime

Native mobile stack for Lighthouse — **no Capacitor, no WebView, no JS runtime on device**.

## Architecture

```
Lighthouse ARC → app.fr (Frontier syntax)
       ↓
Frontier compiler (external) → machine code
       ↓
libfrontier_app.so / .a  (~200KB runtime + compiled app)
       ↓
Platform shell (Kotlin / Swift, ~50 lines)
       ↓
~3MB APK / ~2MB IPA
```

## Build (desktop test)

```bash
cd mobile/frontier-runtime
cargo test
cargo build --release
```

## Build all targets

```bash
bash mobile/build-native.sh
# Output: releases/native/
```

## Android cross-compile

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
# Install Android NDK r26+, set:
export ANDROID_NDK_HOME=/path/to/ndk
export PATH="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
bash mobile/build-native.sh
```

## Package native APK

```bash
node -e "require('./lib/frontier-mobile').buildNativeApk('releases/lighthouse-native.apk')"
```

## Features

| Feature | Flag | Default |
|---------|------|---------|
| On-device AI (llama.cpp) | `--features ai` | off |
| HTTP client | `--features network` | off |

## License

MIT
