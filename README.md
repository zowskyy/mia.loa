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

**Manual:**

```bash
node release.js --dry-run
node release.js all
```

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Requirements

- Node.js 18+
- 4GB free disk space (server model)
- 2GB+ RAM (4GB recommended; 8GB+ for on-device WebLLM)

## Cursor Gate

This repo includes the [Cursor Gate](https://github.com/zowskyy/Schema) stack for agent-driven code review. Gate reviewer deps live in `requirements-gate.txt` (Node runtime deps remain in `package.json`).

```bash
pip install -r requirements-gate.txt
bash scripts/install-agent-environment.sh
bash scripts/gate-file.sh --file samples/hello_passing.py
```

PR CI: workflow `Gate Check` runs the gate on `samples/hello_passing.py`. Gap audit: [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT — Free forever.
