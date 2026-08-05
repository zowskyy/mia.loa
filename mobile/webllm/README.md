# On-Device AI (WebLLM) — Tier 3

Experimental on-device inference using [WebLLM](https://webllm.mlc.ai/). Runs entirely in the browser via WebGPU — no server needed for AI inference.

## Requirements

- Chrome 127+ or Edge 127+ with WebGPU enabled
- Flagship phone or desktop: **8GB+ RAM** recommended
- ~2GB download on first use (Qwen2.5-Coder-1.5B quantized)

## How to enable

1. Open Lighthouse in Chrome on a WebGPU-capable device
2. Tap **☁️ Server** in the header → switches to **🧠 On-Device**
3. Wait for model download (one-time, ~2GB)
4. Send requests — ARC cycle runs locally on your device

## Architecture

```
Phone Browser
  ├── webllm.js          OnDeviceModel class
  ├── webllm-bridge.js   Client-side ARC cycle
  └── WebLLM + WebGPU    Model inference (no server)
```

## Limitations

- **Not for low-end phones** — $100 Android devices lack WebGPU/RAM
- **iOS Safari** — WebGPU support limited; use server mode or Capacitor + server
- **First load slow** — model caches in browser storage after first download
- **Prototype quality** — 1.5B model, less capable than 7B server model

## Files

| File | Purpose |
|------|---------|
| `mobile/webllm/lighthouse-webllm.js` | Source of truth |
| `public/webllm.js` | Browser-served copy |
| `public/webllm-bridge.js` | UI integration + on-device ARC |

Keep `public/webllm.js` in sync with `mobile/webllm/lighthouse-webllm.js` when editing.
