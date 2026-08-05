# Lighthouse Mobile (Capacitor)

Wraps the Lighthouse PWA in a native Android/iOS shell with file system access, share sheet, and clipboard.

## Prerequisites

- Node.js 18+
- Lighthouse server running on your network (RPi, laptop, etc.)
- Android Studio (Android) or Xcode (iOS)

## Quick Start

```bash
# 1. Build web assets and Capacitor config
cd mobile/capacitor
npm install
node build-mobile.js --server http://192.168.1.10:8899

# 2. Add native platform (first time only)
npm run add:android
# or: npm run add:ios

# 3. Open in IDE and run
npm run android
# or: npm run ios
```

## Server URL

The app loads the UI from Capacitor's `www/` bundle but talks to your Lighthouse server for AI inference.

Point it at your server:

```bash
node build-mobile.js --server http://192.168.1.10:8899
npm run sync
```

Find your server URL: run `node core.js` on the host and look for `📱 Phone:` in the terminal, or visit `/api/connect`.

## What the native shell adds

| Feature | Browser PWA | Capacitor App |
|---------|-------------|---------------|
| Home screen install | ✅ | ✅ |
| File save to Documents | ❌ | ✅ |
| Native share sheet | Partial | ✅ |
| Clipboard | ❌ | ✅ |
| Status bar theming | ❌ | ✅ |

## On-device AI (Tier 3)

For phones with WebGPU (Chrome 127+, flagship devices), enable **On-Device AI** in the app header. No server needed for inference — model runs in the browser via WebLLM.

## Troubleshooting

- **Blank screen**: Check `--server` URL matches your Lighthouse host
- **Cleartext HTTP blocked**: Android allows cleartext when `cleartext: true` in config (already set)
- **Build fails**: Run `npm run add:android` before `npm run android`
