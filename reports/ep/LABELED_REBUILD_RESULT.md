# Labeled rebuild result — `ep_model.joblib`

**Date:** 2026-10-11  
**Status:** Binding acceptance **PASS**  
**Label:** `rebuild: labeled_new_artifact` — **not** the lost original  
**Procedure:** [`LABELED_REBUILD_PROPOSAL.md`](./LABELED_REBUILD_PROPOSAL.md)  
**Full search + rebuild packet (store):** project store `docs/ARTIFACT_RECOVERY_OR_REBUILD.md`

## Recovery (Phase A)

Original production joblib **not found** (store tarballs/bundles, git history/LFS, committed path). Pytest fixtures are not substitutes.

## Rebuild (Phase B)

| Item | Value |
| --- | --- |
| Scratch `--out` | `/tmp/nfl-ep-labeled-rebuild` |
| Command | `python3 -m nfl_sim.models train --out /tmp/nfl-ep-labeled-rebuild` (no `--include-test`) |
| Packages | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 |
| Lake pins 2019–2023 | Exact match to committed meta `data_hash.season_sha256` |
| Committed `reports/ep` baselines | **Unchanged** by train |

### Acceptance

| Check | Target | Result |
| --- | --- | --- |
| `selected_C` | `0.25` | **PASS** |
| `train_n` | `116218` | **PASS** |
| `val_log_loss_by_C["0.25"]` | `1.3360995567698928` (ε≤1e-6) | **PASS** (δ=`0.0`) |
| Season sha256 | committed pins | **PASS** |

### New artifact identity

| Field | Value |
| --- | --- |
| Joblib sha256 | `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` |
| Size | 6663 B |
| Meta provenance | `rebuild: labeled_new_artifact`, `rebuild_date: 2026-10-11` |
| Git | **Not** committed (`.joblib` remains gitignored) |
| Committed path `reports/ep/artifacts/ep_model.joblib` | Still absent — promotion is a separate decision |

Load via `EPModel.load(<scratch-or-store-path>)` or CLI `--model`. Do not misrepresent as original.
