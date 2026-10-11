# Labeled rebuild proposal — `ep_model.joblib` (NOT EXECUTED)

**Date:** 2026-10-11  
**Status:** Proposal **corrected for output isolation + binding acceptance** — still **do not run** until explicit user authorization.  
**Reason:** Original production artifact not found; pytest fixtures (~5502 B) are **not** substitutes.  
**C1.1 base tip (pre-this-commit):** `c96288306924e185f0f281be19e5a037411e80df`  
**Inspection:** docs + static code read of `nfl_sim.models` train path only (no train / pytest / lake).

## Goal

Produce a **new** Stage A EP artifact under an **isolated scratch `--out`**, with explicit rebuild provenance. Never label it as the lost original. Prefer **restore original** joblib if a trustworthy copy appears.

---

## A. Prerequisites (must be true before authorize)

| Prerequisite | Status / rule |
| --- | --- |
| Pinned lake **2019–2023** matching meta `data_hash.season_sha256` | **Gap** on this VM (`data/raw/` empty) |
| 2023 Parquet on disk | **Required by current CLI** — `cmd_train` → `build_modeling_frame(ALL_MODEL_SEASONS)` → `load_raw_seasons` raises if any season file missing. 2023 is **disk-only for frame/hash construction**; must **not** be used for fit, C-select, eval, or tune (omit `--include-test`) |
| Package pins | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 (or **stop** — do not auto-relax log-loss) |
| Chat phrase | User says **“authorize labeled rebuild”** (or equivalent explicit grant) |
| Post-train labeling | Train path does **not** write `rebuild:`; operator **must** patch new meta in scratch (section D) |
| Output isolation | Train **must** use scratch `--out` (section B); never default/`../reports/ep` for a labeled rebuild |

## B. Exact command (when authorized) — isolated scratch

```bash
cd /path/to/nfl-analytics-simulator/backend
# Outside committed reports/ep — verified: all train writes are under Path(args.out)
SCRATCH="${SCRATCH:-/tmp/nfl-ep-labeled-rebuild}"
mkdir -p "$SCRATCH"
# Lake pins must match reports/ep/artifacts/ep_model.meta.json data_hash.season_sha256 for 2019–2023
python3 -m nfl_sim.models train --out "$SCRATCH"
# Do NOT pass --include-test (avoids scoring/evaluating 2023; 2023 files still must exist on disk).
# Do NOT use --out ../reports/ep (would overwrite committed metrics/meta/calibration/TARGETS).
```

### Verified CLI: what `--out` controls

From `backend/src/nfl_sim/models/__main__.py` (`cmd_train`) + `ep_model.train_and_evaluate`:

| Write | Path under `--out` |
| --- | --- |
| Model binary | `{out}/artifacts/ep_model.joblib` |
| Model meta JSON | `{out}/artifacts/ep_model.meta.json` |
| Metrics JSON | `{out}/metrics.json` (written in `train_and_evaluate`, then rewritten by `cmd_train` after val EPA reference MAE) |
| TD calibration CSV | `{out}/calibration_touchdown.csv` (validate only) |
| Targets stub | `{out}/TARGETS.md` (`cmd_train` only) |

**Not written by `train`:** `baselines_2022.json`, `reconciliation_2022.json`, `reference_agreement.json`, `EVALUATION.md`, `AUDIT.md`, or anything under `reports/ep/scoring_credit/`. Those use other subcommands with their own `--out` / defaults.

**Hard-coded `reports/ep` in train path?** **No.** Train uses only `Path(args.out)`. Default when `--out` omitted is `REPO_ROOT/reports/ep` — that default **must not** be used for labeled rebuild.

**Scratch isolation:** With `--out /tmp/nfl-ep-labeled-rebuild` (or any path ≠ committed `reports/ep`), train does **not** touch committed baselines (`metrics.json`, `calibration_touchdown.csv`, `TARGETS.md`, `artifacts/ep_model.meta.json`, etc.). `.gitignore` only ignores `reports/ep/artifacts/*.joblib`; meta/metrics under `reports/ep` are tracked — overwriting them would dirty git history of Stage A reports.

### Loading scratch model + meta (no training-code changes)

| Consumer | Scratch support | Notes |
| --- | --- | --- |
| `EPModel.load(path)` | **Yes** — any path | Used by eval/score/reconcile/baselines |
| `python -m nfl_sim.models eval --model …` | **Yes** — `--model` required | Builds `ALL_MODEL_SEASONS` frame (2023 on disk still required) |
| `… reconcile --model … --out …` | **Yes** | Point both at scratch; do not default-overwrite `reports/ep/reconciliation_2022.json` |
| `… baselines --model … --out …` | **Yes** | Point `--out` at scratch JSON |
| `scripts/epa_scoring_credit_diagnostic.py` | **No CLI** for model/meta path | Hard-codes `reports/ep/artifacts/…` for **status only**; scores lake `ep`, not project joblib |
| API `_load_ep_model` | **Hard-coded** `reports/ep/artifacts/ep_model.joblib` | Cannot serve scratch without copying into that path |

**Stop rule (no training-code edits):** If a required check can only run by placing an unlabeled new joblib/meta onto committed `reports/ep/artifacts/` in a way that **misrepresents** it as the lost original, **stop**. Do not modify training code to add isolation flags. Promotion into `reports/ep/artifacts/` is a **separate, later decision** and must keep `rebuild: labeled_new_artifact` meta.

## C. Fit parameters (from code + committed meta)

| Param | Value |
| --- | --- |
| Seed | `42` (`RANDOM_SEED` / meta `seed`) |
| Train | 2019–2021 (`TRAIN_SEASONS`) |
| Validate / C select | 2022 only → expect `selected_C=0.25` |
| Era | excluded from production (`era_feature: excluded_from_production`) |
| Output | **scratch** `{out}/artifacts/ep_model.joblib` + **new** `ep_model.meta.json` |
| Meta / metrics `data_hash` | Train hashes **2019–2023** even when `--include-test` is off |
| `train_n` definition | `EPModel.fit` → `meta["train_n"] = len(train_df)` after `eligible_mask` (REG + non-null down/distance/yardline_100/half_seconds + posteam/home_team + valid `ep_label` in `EP_CLASSES`) and split=`train` |

## D. Binding acceptance + post-train labeling

| Check | Target | Binding rule |
| --- | --- | --- |
| `selected_C` | `0.25` | **Exact** (meta + metrics `hyperparam_selection.selected_C`) |
| `train_n` | `116218` | **Exact** — same definition as above / committed meta |
| `val_log_loss_by_C["0.25"]` | `1.3360995567698928` | If lake pins + package pins match meta: abs delta **≤ 1e-6**. If env does **not** match: **stop** — do **not** auto-relax ε |
| Season sha256 | committed meta pins **2019–2023** | **Exact** match |
| 2023 usage | on disk for load/hash only | **No** fit / C-select / `--include-test` eval / tune |
| New joblib sha256 | record in rebuild report | required |
| Committed `reports/ep` baselines | unchanged by train | required (scratch `--out`) |
| Labeling | meta `rebuild` fields below | required — **not** `original` |

**Post-train meta patch (required — train does not write these keys):** after `train` succeeds, edit **scratch** `{out}/artifacts/ep_model.meta.json` to add (keep other fields from train output):

```json
{
  "rebuild": "labeled_new_artifact",
  "rebuild_date": "YYYY-MM-DD",
  "rebuild_note": "New Stage A artifact; not bit-identical to lost original"
}
```

Also record `sha256sum "$SCRATCH/artifacts/ep_model.joblib"` in a short rebuild report. Never claim bit-identity with the lost file.

## E. Separate gates (do not collapse)

| Gate | What it authorizes | What it does **not** |
| --- | --- | --- |
| **Labeled rebuild** (this doc) | Run isolated train + label new artifact | Authorize model-surface Convention B; merge PR; WP |
| **Restore original** | Place recovered joblib beside committed meta | Same as above — still need model-surface |
| **Model-surface B** | Project-EP pre/post Convention B on **2019–2022 only** | Rebuild; WP kickoff; 2023/2024 tuning |
| **2023** | Prior-exposure / report-only history; sealed vs WP selection | Pristine holdout claim; fit/select/eval/tune |
| **2024** | Future sealed test **only after** pin + untouched audit | Not sealed until audited |

**Rebuild ≠ authorize model-surface B.** Completing a labeled rebuild only produces a candidate artifact under scratch (+ provenance). Model-surface still needs its own explicit authorization.

## F. Authorization readiness (decision aid)

| Ready to authorize labeled rebuild? | Condition |
| --- | --- |
| **No — execute** | This document alone never authorizes train |
| **Ask user (proposal text OK)** | A–E match CLI; host has pinned 2019–2023; operator will use scratch `--out`, binding acceptance, post-train `rebuild:` patch |
| Prefer restore instead | Backup joblib can be paired with current committed meta |
| **Not ready — stop** | Cannot isolate outputs; cannot meet binding ε without relaxing; cannot load new model for required checks without misrepresenting it as original |

### Post-rebuild (still gated; not part of authorize-train)

1. Explicit authorize → Convention B project-`model_epa` pre/post on **2019–2022 only** (load scratch via `--model` / `EPModel.load`; do not silently overwrite committed baselines).  
2. Do not tune on 2023–2025.  
3. Keep gitignore; do not force-commit binary unless policy changes.  
4. 2024 remains **unsealed** until audited.

## Not authorized by this document

Executing the train command; using default/`../reports/ep` `--out` for rebuild; silent substitute; claiming bit-identity with the lost file; auto-relaxing log-loss tolerance; code changes to auto-write `rebuild:` or add CLI isolation flags (report-only gap — scratch `--out` + docs patch is the approved workaround); authorizing model-surface B or WP; merging PR #7.
