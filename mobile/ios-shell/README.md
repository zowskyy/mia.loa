# Lighthouse Frontier iOS Shell

~50 lines of Swift. No WebView. No JavaScript runtime.

## Build on macOS

1. Create Xcode iOS App project or open this folder
2. Add `AppDelegate.swift`
3. Link `releases/native/ios/libfrontier_app.a` (from `bash mobile/build-native.sh` on macOS)
4. Add bridging header importing `frontier_runtime.h`
5. Call `frontier_app_main()` from `didFinishLaunching`
6. Product → Archive → Distribute

## Or use Lighthouse CI

`node release.js ios` packages this shell + static library when built.
