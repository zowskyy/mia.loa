# ⚡ Lighthouse

**Free offline AI coding agent. No subscription. Works on phones, RPi, anything.**

## Quick Start

```bash
npm install          # One dependency: express
node setup.js        # Download model (~4GB, one-time)
node core.js         # Start server
# Open http://localhost:8899
```

## Mobile — Three Tiers

| Tier | What | Setup |
|------|------|-------|
| **1: PWA** | Browser + home screen install | Open `http://<server>:8899` on phone |
| **2: Capacitor** | Native Android/iOS app shell | `cd mobile/capacitor && npm install && node build-mobile.js` |
| **3: WebLLM** | On-device AI in browser (WebGPU) | Tap **🧠 On-Device** in app header |

### Connect your phone (Tier 1)

1. Run `node core.js` on your laptop/RPi
2. Open `http://<server-ip>:8899/connect.html` on any device
3. Scan the QR code with your phone

### Native app (Tier 2)

```bash
cd mobile/capacitor
npm install
node build-mobile.js --server http://192.168.1.10:8899
npm run add:android    # first time
npm run android        # open Android Studio
```

See [mobile/capacitor/README.md](mobile/capacitor/README.md).

### On-device AI (Tier 3)

Requires Chrome 127+ with WebGPU and 8GB+ RAM. Enable via the header toggle. See [mobile/webllm/README.md](mobile/webllm/README.md).

## Modes

| Mode | What it does |
|------|--------------|
| Server mode | Uses llama-server (fastest, persistent) |
| CLI mode | Uses llama-cli (works everywhere) |
| Learning mode | No model needed — explains concepts |
| On-device (WebLLM) | Model runs in browser via WebGPU |

## Features

- 🧠 **ARC Cycle** — Analyzes → Plans → Codes → Self-Reviews
- 💡 **Idea Mode** — Describe your idea, get questions, then code
- 📱 **Phone Ready** — PWA, voice input, share sheet, wake lock
- 🔌 **Fully Offline** — After model download, zero internet
- 💾 **Projects** — Save and load your work
- 🖥️ **CLI** — Terminal mode for headless systems

## Field deployment

```bash
node deploy.js test                    # Verify readiness
node deploy.js ship east-africa        # Full kit + docs + training + partners
node deploy.js kit south-asia          # Community Kit only
./deploy.sh all global                 # Shell wrapper
```

Regions: `east-africa`, `south-asia`, `southeast-asia`, `latin-america`, `west-africa`, `global`

Output goes to `deploy/` — Community Kits, offline docs, i18n, Navigator training, partner packages, impact dashboard.

## Release builds

**CI/CD (ships all 13 formats):** push a version tag and GitHub Actions builds everything:

```bash
git tag v1.0.2 && git push origin v1.0.2
```

Workflows: `.github/workflows/release-all.yml` + `.github/workflows/a-plus-hard-gate.yml`

**Manual:**

```bash
node release.js --dry-run
node release.js all
```

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Frontier-Syntax integration

Lighthouse generates code; [Frontier-Syntax](https://github.com/zowskyy/frontier-syntax) verifies and compiles it.

| Layer | Location | Status |
|-------|----------|--------|
| In-browser validation | `public/frontier-parser.js` + `public/syntax/` | Cycle 1 lexer active; WASM auto-loads at Cycle 6 |
| Native compile | `POST /api/frontier/compile` | Requires `FRONTIER_COMPILER` or `FRONTIER_HOME` |
| Sync assets | `./scripts/sync-frontier-syntax.sh` | Pull token table + WASM from frontier-syntax |

**Pipeline:** idea → ARC generates code → Frontier validates in browser → optional native binary via Frontier compiler.

Set `FRONTIER_HOME` to a local `frontier-syntax` checkout after `cargo build --release`.

## Frontier total overhaul (dependency elimination)

| Legacy | Frontier replacement | Script |
|--------|---------------------|--------|
| JavaScript ARC output | `.fr` native source | `npm run frontier:codegen` |
| Capacitor / WebView | Native APK (~3MB) | `npm run frontier:mobile` |
| Node.js + Express server | Static server binary | `npm run frontier:server` |
| npm install + multi-file deploy | Single binary | `npm run frontier:single` |
| Platform installers | Cross-compiled binaries | `npm run frontier:cross` |
| WebLLM | llama.cpp FFI | `scripts/frontier-ai-bindings.js` |

Run everything: `npm run frontier:standalone`

Set `LIGHTHOUSE_OUTPUT=frontier` for ARC to emit **only** `.fr` files (no JS).

## Requirements

- Node.js 18+
- 4GB free disk space (server model)
- 2GB+ RAM (4GB recommended; 8GB+ for on-device WebLLM)

## License

MIT — Free forever.
