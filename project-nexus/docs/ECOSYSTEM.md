# Project Nexus Ecosystem

Companion to [frontier-syntax](https://github.com/zowskyy/frontier-syntax).

| Layer | Repo / Path | Role |
|-------|-------------|------|
| Syntax | frontier-syntax | Lexicon, grammar, A+ Hard Gate cycles 1–6 |
| IDE | **this repo** `cursor/` | Cursor-like IDE in pure Frontier |
| Orchestrator | `build/arc_orchestrator.py` | Slide-gated verification |
| Gates | `gates/slide_15_gates.json` | Formal A+ targets |

## Self-hosting loop

```
Natural language → Frontier AI → .frontier source → Compiler → Native
        ↑                                                      │
        └────────────── Cursor IDE (this repo) ←───────────────┘
```

When Slide 15 passes, Nexus includes a world-class IDE written entirely in Frontier.
All subsequent development can happen inside the IDE itself.
