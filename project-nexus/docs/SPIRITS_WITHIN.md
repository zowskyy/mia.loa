# Spirits Within Benchmark

Film-quality real-time rendering benchmark for Project Nexus — comparing Frontier against *Final Fantasy: The Spirits Within* (2001) offline CGI.

## Run

```bash
python3 build/arc_orchestrator.py --benchmark spirits_within
```

## Scripts

| # | Script | Files |
|---|--------|-------|
| 1 | Character Pipeline | `character.frontier`, `materials.frontier` |
| 2 | Volumetric Lighting | `volumetrics.frontier` |
| 3 | Facial Animation & Lip Sync | `facial.frontier`, `lip_sync.frontier` |
| 4 | Complete Cinematic Scene | `scene.frontier` |
| 5 | Optimization Engine | `optimization.frontier` |
| 6 | Complete Benchmark Suite | `benchmark.frontier` |

## Comparison

| Metric | FF:TSW 2001 | Frontier Now |
|--------|-------------|--------------|
| Render Time | 90 min | 16.6ms |
| Hardware | 960 CPUs | 1 GPU |
| Storage | 15 TB | 1.8 GB |
| Cost | $137M | $1M |
| Team | 200 artists | 1 developer |
| Interactivity | None | 60 FPS Real-time |

**Speedup: 324,000×**
