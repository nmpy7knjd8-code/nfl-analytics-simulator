# Phase 2 review pack — historical ingest + game replay

**Status:** Complete on branch `cursor/phase2-historical-ingest-a4c3` (2026-10-11).  
**Product scope:** Historical replay only — not EP training, not 4th-down/clock recommendations.

Use this page + [HANDOFF.md](HANDOFF.md) for an external accuracy check.

## Acceptance claimed

| Criterion | Evidence |
| --- | --- |
| Load 2023 PBP reproducibly | `nflreadpy==0.1.5`; 49,665 rows; pinned sha256; immutable raw |
| Canonical Parquet + DuckDB | Observed / derived / reference separated; `ep`/`epa`/`wp` = reference |
| API: list games, metadata, ordered plays | Paginated; smoke game `2023_01_DET_KC` (179 plays) |
| Minimal Next.js replay UI | Historical labels; no claim of trained models |
| Tests actually run | Backend **16 passed**; frontend **2 passed** + typecheck/build |

## Primary evidence

- Hub: [HANDOFF.md](HANDOFF.md) — reproduce commands, pins, limitations  
- Roadmap: [ROADMAP.md](ROADMAP.md) — next = Phase 3 EP→EPA after approval; decision lab = Phase 6  
- Architecture / data map: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA_EXPERIMENT.md](DATA_EXPERIMENT.md)

## Reproduce

```bash
cd backend
python3 -m pip install -e ".[dev,phase2]"
python -m nfl_sim.ingest --season 2023
pytest -q
python -m nfl_sim.api

cd ../frontend
npm install && npm run dev   # http://localhost:3000/games
```

Branch: `cursor/phase2-historical-ingest-a4c3`

## Explicitly not done in Phase 2

- Trained EP/EPA/WP models  
- Live feeds  
- 4th-down / clock decision recommendations  
- Full 2019–2022 backfill (2023 smoke only)

## What a reviewer should verify

1. HANDOFF test table matches “actually run,” not aspirational commands.  
2. Reference nflverse EP columns are not described as “our model.”  
3. Decision/strategy features are not marketed as shipped.  
4. Data pin (URL, version, hash, row count) is present and reproducible.
