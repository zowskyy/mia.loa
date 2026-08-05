# Frontier Syntax assets (Lighthouse integration)

Vendored from [zowskyy/frontier-syntax](https://github.com/zowskyy/frontier-syntax) under MIT.

| File | Cycle | Purpose |
|------|-------|---------|
| `token_regex_table.json` | 1 | In-browser lexer validation (fallback until WASM ships) |
| `wasm_parser.wasm` | 6 | Full AST parse in browser (drop in when built) |

## Sync from Frontier-Syntax

```bash
./scripts/sync-frontier-syntax.sh
```

Or set `FRONTIER_HOME` to a local `frontier-syntax` checkout — Lighthouse's server compile step uses `target/release/frontier` from that path.
