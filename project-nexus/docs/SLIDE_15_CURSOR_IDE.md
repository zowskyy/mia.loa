# Slide 15 — Cursor IDE Design Notes

## Intent

Build a self-hosted Cursor-like IDE entirely in Frontier Syntax as the ultimate dogfooding / self-hosting proof for Project Nexus.

## Non-negotiables

1. No C++ under `cursor/` — pure `.frontier` sources
2. A+ Hard Gate verification via `build/arc_orchestrator.py --slides 15`
3. Embedded AI that understands Frontier (generate / review / optimize / NL→code)
4. GPU UI path with sub-pixel fonts and theme system
5. Hot-reload < 100ms and compiled footprint < 50MB

## Component map

| Module | Responsibility |
|--------|----------------|
| `editor/core` | Buffer, cursor, selection, syntax, input < 0.1ms |
| `ai/engine` | Inference, ARC self-correct, optimize, review |
| `ai/chat` | Conversational panel → apply code to editor |
| `explorer` | Virtual filesystem tree, open-in-editor |
| `terminal` | Frontier CLI + shell + project run/test |
| `lsp/services` | AST, symbols, completions, diagnostics, actions |
| `build/system` | Incremental compile, hot-reload, package |
| `optimization/performance` | Glyph atlas, token cache, predict preload |
| `ui/visual` | Themes, sub-pixel, GPU UI, animation |
| `app` | Layout shell wiring all panels |

## Orchestrator

The ARC orchestrator is the single entry point for Slide 15 certification. It validates component presence, purity, and gate metrics, then writes `audit_reports/slide_15_report.{json,md}`.
