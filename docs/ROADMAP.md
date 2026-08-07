# Lighthouse — Gap Audit

Audit date: 2026-08-07. Repo state: Cursor Gate bootstrapped; Node.js runtime intact.

## Repository gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Frontier integration reverted (PR #3) | High | `lib/frontier*.js` removed; `project-nexus/` mirror is the path forward |
| `project-nexus/` not wired into Lighthouse runtime | High | Mirror only — see `project-nexus/MIRROR.md` |
| No gate on `core.js` / `deploy.js` | Medium | Gate CI runs `samples/hello_passing.py` only |
| `npm install` required before first run | Low | Documented in README; no lockfile CI check |
| Android keystore signing not configured | Low | `ANDROID_KEYSTORE` secret optional per RELEASE_CHECKLIST |
| Model download (~4GB) not in CI | Low | By design — `node setup.js` is manual |

## Frontier integration history

PR #3 (`cursor/frontier-integration-984d`) added Frontier-native mobile stack and WASM compiler but was **reverted** on `main` (commit `7af99df`). Rationale: integration landed before standalone `project-nexus` repo was ready.

`project-nexus/` subdirectory mirrors [zowskyy/project-nexus](https://github.com/zowskyy/project-nexus) until the Cursor GitHub App has push access.

## Completed in this bootstrap

- [x] `cursor_gate.py` + `cursor_gate_fastest.py`
- [x] `scripts/gate-file.sh`, `gate-all-changed.sh`, `install-agent-environment.sh`
- [x] Sample fixtures (`hello_passing.py`, `hello.py`)
- [x] Agent policy (`AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`)
- [x] CI gate-check workflow (`.github/workflows/gate-check.yml`)
- [x] `requirements-gate.txt` — gate deps separated from Node runtime
- [x] `.env.example`, `LICENSE`, `docs/USER_RULES_PASTE.md`

## Next milestones

1. Re-integrate Frontier when `project-nexus` standalone repo is gate-ready.
2. Add gate coverage for critical JS modules (`core.js`, `deploy.js`) via sample wrappers or AST lint rules.
3. Wire `project-nexus/build/arc_orchestrator.py --slides 15` into release CI as optional job.
4. Configure `ANDROID_KEYSTORE` secret for signed APK releases.
