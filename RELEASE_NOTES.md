# Lighthouse v1.0.1 — Universal Release

**Build ID:** msfjdea2-qnps
**Build Date:** 2026-08-05T03:37:25.898Z
**License:** MIT — Free Forever

## What is Lighthouse?

A **free, offline AI coding agent** that turns ideas into working software.
No subscription. No cloud. No API keys. Works on phones, Raspberry Pis, and old laptops.

## ARC Self-Review Cycle

1. **Analysis** — Understands what you need
2. **Plan** — Creates a step-by-step implementation plan
3. **Code** — Generates complete working software
4. **Review** — Self-critiques and refines until quality threshold met

## Desktop (6 platforms)

- **linux-x64** — `lighthouse-1.0.1-linux-x64.tar.gz` — For most Linux desktops and servers. Intel/AMD 64-bit.
- **linux-arm64** — `lighthouse-1.0.1-linux-arm64.tar.gz` — For Raspberry Pi 4, 5, Orange Pi 5, and other ARM64 SBCs.
- **linux-armv7l** — `lighthouse-1.0.1-linux-armv7l.tar.gz` — For Raspberry Pi 2, 3, and older ARM boards. 32-bit.
- **macos-x64** — `lighthouse-1.0.1-macos-x64.tar.gz` — For Intel-based Macs. macOS 11+ (Big Sur or newer).
- **macos-arm64** — `lighthouse-1.0.1-macos-arm64.tar.gz` — For M1/M2/M3 Macs. macOS 11+ (Big Sur or newer).
- **windows-x64** — `lighthouse-1.0.1-windows-x64.zip` — For Windows 10/11 64-bit. Includes .bat launcher.

## Mobile (3 platforms)

- **android-arm64** — `lighthouse-1.0.1-android-arm64.apk` — Native Android app via Capacitor. Requires server on same network.
- **android-armv7** — `lighthouse-1.0.1-android-armv7.apk` — For older Android devices. Same universal APK as ARM64 build.
- **ios** — `lighthouse-1.0.1-ios.tar.gz` — Xcode project for building iOS IPA. Requires macOS with Xcode 15+.

## Special & Portable

- **portable** — `lighthouse-1.0.1-portable.zip` — Lightweight version. Run "node setup.js" after extracting.
- **docker** — `lighthouse-1.0.1-docker.tar` — Docker image for server deployment. Model mounted as volume.
- **rpi-installer** — `lighthouse-1.0.1-rpi-installer.tar.gz` — RPi installer script + Lighthouse + model. Not a raw SD image.
- **community-kit** — `lighthouse-1.0.1-community-kit.tar.gz` — Full kit: Lighthouse + model + docs + training + deployment scripts.

## Quick Start

```bash
tar -xzf lighthouse-1.0.1-linux-x64.tar.gz
cd lighthouse-1.0.1-linux-x64
npm install --production
node core.js
```

## SHA256 Checksums

```bash
sha256sum -c SHA256SUMS
```

*Lighthouse is MIT licensed. Free forever. No exceptions.*
