# Labeled rebuild proposal — `ep_model.joblib` (NOT EXECUTED)

**Date:** 2026-10-11  
**Status:** Proposal only — **do not run** until explicit user authorization.  
**Reason:** Original production artifact not found; pytest fixtures (~5502 B) are **not** substitutes.

## Goal

Produce a **new** Stage A EP artifact with explicit rebuild provenance. Never label it as the lost original.

## Prerequisites (gaps until ready)

| Prerequisite | Status |
| --- | --- |
| Pinned lake 2019–2022 matching meta `season_sha256` | **Gap** on publish VM (`data/raw/` empty) |
| 2023 on disk for report-only (optional `--include-test`) | Not required for rebuild fit; keep sealed for tuning |
| Package pins | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 (or document drift) |
| Explicit chat authorization: “authorize labeled rebuild” | **Pending** |

## Exact command (when authorized)

```bash
cd /path/to/nfl-analytics-simulator/backend
# Ensure lake pins match reports/ep/artifacts/ep_model.meta.json data_hash.season_sha256
python3 -m nfl_sim.models train --out ../reports/ep
# Do NOT pass --include-test for selection/tuning. Optional later: report-only 2023 with --include-test after freeze.
```

| Param | Value |
| --- | --- |
| Seed | `42` (`RANDOM_SEED` in `ep_model.py` / meta) |
| Train | 2019–2021 |
| Validate / C select | 2022 only → expect `selected_C=0.25` |
| Era | excluded from production |
| Output | `reports/ep/artifacts/ep_model.joblib` + **new** `ep_model.meta.json` |

## Acceptance tolerances (new artifact)

| Check | Target | Tolerance |
| --- | --- | --- |
| `selected_C` | `0.25` | exact |
| `val_log_loss_by_C["0.25"]` | `1.3360995567698928` | suggest ≤ 1e-6 abs if same lake+packages; else document delta |
| `train_n` | `116218` | exact if same REG scrimmage eligibility |
| Season sha256 | match meta pins | exact |
| New joblib sha256 | record in rebuild report | required |
| Labeling | meta `rebuild: labeled_new_artifact` (or equivalent) + date | required — **not** `original` |

## Post-rebuild (still gated)

1. Convention B project-`model_epa` pre/post on **2019–2022 only**.  
2. Do not tune on 2023–2025.  
3. Keep gitignore; do not force-commit binary unless policy changes.

## Not authorized by this document

Executing the train command; silent substitute; claiming bit-identity with the lost file.
