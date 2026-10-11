# EP model artifact provenance — Convention B gate

**Date:** 2026-10-11  
**Agent:** convention-b-gate (`bc-f0a51a0e-e43d-5b30-a461-3f132b728222`)  
**Constraint:** No silent retrain/substitute claiming to be the original Stage A artifact.

## Committed meta (production identity target)

| Field | Value |
| --- | --- |
| Absolute path | `/tmp/work/nfl-analytics-simulator/reports/ep/artifacts/ep_model.meta.json` |
| Present | **Yes** (tracked in git) |
| `selected_C` / `C` | `0.25` |
| `era_feature` | `excluded_from_production` |
| `train_seasons` | 2019, 2020, 2021 |
| `train_n` | 116218 |
| `seed` | 42 |
| Packages | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 |
| `gate` | `stage_a_audit_pass` |
| Data hashes | see meta `data_hash.season_sha256` (2019–2023 pins) |

## Candidates searched

| Candidate | Absolute path | Size | SHA-256 | Rel. to meta | Deserialized? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Production joblib | `/tmp/work/nfl-analytics-simulator/reports/ep/artifacts/ep_model.joblib` | — | — | Would pair with meta above | **N** | **MISSING** (gitignored; absent on fresh clone and this VM) |
| Store artifacts dir | `/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34/artifacts/` | empty | — | — | N | No joblib |
| Store recursive `*.joblib` | under `/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34` | — | — | — | N | **None found** |
| Phase2 tarballs | `internal/phase2-*.tar.gz` | — | — | Pre-Stage-A | N | No `ep_model.joblib` members |
| Pytest fixture (prior Task A VM note) | `/tmp/pytest-of-ubuntu/pytest-*/test_api_rejects_model_path_an0/ep_model.joblib` | ~5502 B | `e2bd3446f8b15ee2792a81d0df88b2f2aef037447ee77133147a0a822d921c07` (per Task A location note) | **Not** Stage A train artifact | **N** (must not) | Tiny API stub only — **forbidden** as production substitute |
| Git history | `git log --all -- **/ep_model.joblib` | — | — | — | N | Never committed (ignored) |

### Ignore status

```
.gitignore:25:reports/ep/artifacts/*.joblib → reports/ep/artifacts/ep_model.joblib
```

Confirmed via `git check-ignore -v` and `git status --ignored`.

## Rebuild procedure (ONLY if user authorizes a **new** artifact — not “original”)

Do **not** run as a silent substitute for the missing original. If authorized later:

```bash
cd /path/to/nfl-analytics-simulator/backend
# Current CLI requires pinned lake 2019–2023 on disk (2023 sealed; no --include-test for selection)
python3 -m nfl_sim.models train --out ../reports/ep
# Then patch new ep_model.meta.json with rebuild: labeled_new_artifact (+ date); see LABELED_REBUILD_PROPOSAL.md
```

| Rebuild param | Required value (from meta) |
| --- | --- |
| Seed | `42` |
| C grid / selected | val-2022 select → `selected_C=0.25` |
| Era | excluded |
| Train seasons | 2019–2021 only |
| Validate | 2022 only |
| On-disk seasons | **2019–2023** required by `ALL_MODEL_SEASONS`; 2023 sealed — **never tune** |

**Acceptance tolerances (new artifact ≠ claim original):** reproduce meta `val_log_loss_by_C["0.25"]` ≈ `1.3360995567698928` within a documented ε (suggest 1e-6 abs if same lake pins + package pins); write **new** meta with `rebuild: labeled_new_artifact` + new sha256; never overwrite history claiming identity with the lost file. Full protocol: [`LABELED_REBUILD_PROPOSAL.md`](./LABELED_REBUILD_PROPOSAL.md).

## Gate impact

| Use | Status |
| --- | --- |
| Lake-`ep` Convention A/B diagnostics (Task A) | Available (parquet/JSON on Task A branch) |
| Project `model_epa` pre/post on 2019–2022 | **Blocked** — original joblib missing |
| Production Convention B code/spec | May proceed; model-surface labeled **unverified / lake-EP only** |
