# Labeled rebuild proposal — `ep_model.joblib` (NOT EXECUTED)

**Date:** 2026-10-11  
**Status:** Proposal **corrected vs code** — still **do not run** until explicit user authorization.  
**Reason:** Original production artifact not found; pytest fixtures (~5502 B) are **not** substitutes.  
**C1 base tip (pre-this-commit):** `4250d13f4a69a38ac20386e8e3cf8f9ba73db75b`

## Goal

Produce a **new** Stage A EP artifact with explicit rebuild provenance. Never label it as the lost original.

---

## A. Prerequisites (must be true before authorize)

| Prerequisite | Status / rule |
| --- | --- |
| Pinned lake **2019–2023** matching meta `data_hash.season_sha256` | **Gap** on this VM (`data/raw/` empty) |
| 2023 Parquet on disk | **Required by current CLI** — `cmd_train` → `build_modeling_frame(ALL_MODEL_SEASONS)` → `load_raw_seasons` raises if any season file missing. 2023 stays **sealed** (no tuning / no C selection); omit `--include-test` so test metrics are not scored at train time |
| Package pins | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 (or document drift) |
| Chat phrase | User says **“authorize labeled rebuild”** (or equivalent explicit grant) |
| Post-train labeling | Train path does **not** write `rebuild:`; operator **must** patch new meta (section D) |

## B. Exact command (when authorized)

```bash
cd /path/to/nfl-analytics-simulator/backend
# Lake pins must match reports/ep/artifacts/ep_model.meta.json data_hash.season_sha256 for 2019–2023
python3 -m nfl_sim.models train --out ../reports/ep
# Do NOT pass --include-test (avoids scoring 2023 at train time; 2023 files still must exist on disk).
```

Verified CLI wiring: `__main__.cmd_train` always builds `ALL_MODEL_SEASONS = (2019,2020,2021,2022,2023)`; `--include-test` only gates whether test split is evaluated and written into `metrics.json`.

## C. Fit parameters (from code + committed meta)

| Param | Value |
| --- | --- |
| Seed | `42` (`RANDOM_SEED` in `constants.py` / meta `seed`) |
| Train | 2019–2021 (`TRAIN_SEASONS`) |
| Validate / C select | 2022 only → expect `selected_C=0.25` |
| Era | excluded from production (`era_feature: excluded_from_production`) |
| Output | `reports/ep/artifacts/ep_model.joblib` + **new** `ep_model.meta.json` |
| Meta `data_hash` | Train code hashes **2019–2023** even when `--include-test` is off |

## D. Acceptance tolerances + post-train labeling

| Check | Target | Tolerance |
| --- | --- | --- |
| `selected_C` | `0.25` | exact |
| `val_log_loss_by_C["0.25"]` | `1.3360995567698928` | suggest ≤ 1e-6 abs if same lake+packages; else document delta |
| `train_n` | `116218` | exact if same REG scrimmage eligibility |
| Season sha256 | match meta pins (2019–2023) | exact |
| New joblib sha256 | record in rebuild report | required |
| Labeling | meta `rebuild` fields below | required — **not** `original` |

**Post-train meta patch (required — train does not write these keys):** after `train` succeeds, edit **new** `reports/ep/artifacts/ep_model.meta.json` to add (keep other fields from train output):

```json
{
  "rebuild": "labeled_new_artifact",
  "rebuild_date": "YYYY-MM-DD",
  "rebuild_note": "New Stage A artifact; not bit-identical to lost original"
}
```

Also record `sha256sum reports/ep/artifacts/ep_model.joblib` in a short rebuild report. Never claim bit-identity with the lost file. Prefer **restore original** if a trustworthy copy appears.

## E. Authorization readiness (decision aid)

| Ready to authorize labeled rebuild? | Condition |
| --- | --- |
| **No — execute** | This document alone never authorizes train |
| **Yes — ask user** | Proposal text matches CLI (A–D verified); user still must grant phrase + host must have pinned 2019–2023 |
| Prefer restore instead | Backup joblib can be paired with current committed meta |

### Post-rebuild (still gated; not part of authorize-train)

1. Convention B project-`model_epa` pre/post on **2019–2022 only**.  
2. Do not tune on 2023–2025.  
3. Keep gitignore; do not force-commit binary unless policy changes.

## Not authorized by this document

Executing the train command; silent substitute; claiming bit-identity with the lost file; code changes to auto-write `rebuild:` (report-only gap — docs patch is the approved workaround until a later code PR).
